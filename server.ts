import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Helper function to call generateContent with retry logic and fallback to avoid 503/UNAVAILABLE errors
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  }
) {
  const primaryModel = params.model || "gemini-3.5-flash";
  const fallbackModel = "gemini-3.1-flash-lite"; // High-availability fallback model
  const maxRetries = 3;
  let delay = 1000; // start with 1s

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] Attempt ${attempt} to generate content using model: ${primaryModel}`);
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      const isTransient = 
        err.status === 503 || 
        err.status === 429 || 
        (err.message && (
          err.message.includes("503") || 
          err.message.includes("429") || 
          err.message.includes("high demand") || 
          err.message.includes("temporary") ||
          err.message.includes("UNAVAILABLE")
        ));
      
      if (isTransient && attempt < maxRetries) {
        console.warn(`[AI] Transient error (attempt ${attempt}/${maxRetries}): ${err.message || err}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
      } else {
        // If it's the last attempt or not a retryable transient error, let's try fallback model if appropriate
        if (primaryModel !== fallbackModel) {
          console.warn(`[AI] Primary model failed or max retries reached. Falling back to ${fallbackModel}. Error:`, err);
          try {
            console.log(`[AI] Attempting with fallback model: ${fallbackModel}`);
            const response = await ai.models.generateContent({
              model: fallbackModel,
              contents: params.contents,
              config: params.config,
            });
            return response;
          } catch (fallbackErr: any) {
            console.error(`[AI] Fallback model ${fallbackModel} also failed:`, fallbackErr);
            throw fallbackErr; // throw original or fallback error
          }
        }
        throw err;
      }
    }
  }
  throw new Error("Failed to generate content after retries");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" })); // Increase JSON payload limit for image uploads

  // API Route: AI OCR (Image Text Extraction)
  app.post("/api/ai/ocr", async (req, res) => {
    const { image, mimeType } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "A chave de API do Gemini (GEMINI_API_KEY) não está configurada no servidor. Por favor, configure-a no painel de Configurações > Secrets." 
      });
    }

    if (!image) {
      return res.status(400).json({ error: "Nenhuma imagem foi fornecida." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Strip potential base64 prefix
      let base64Data = image;
      if (base64Data.includes(";base64,")) {
        base64Data = base64Data.split(";base64,").pop() || "";
      }

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: base64Data,
        },
      };

      const textPart = {
        text: "Você é um assistente profissional de extração de texto especialista em concursos públicos (OCR). Extraia todo o texto legível desta imagem de forma idêntica e organizada. Se a imagem contiver uma questão de múltipla escolha de concurso público (PMBA), formate o enunciado e as alternativas (A, B, C, D, E) perfeitamente de forma limpa, retirando marcações de caneta, números de página ou anotações extras desnecessárias, preservando apenas o texto puro da questão e alternativas. Responda apenas com o texto extraído e formatado.",
      };

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          temperature: 0.1,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Erro no processamento de OCR:", err);
      res.status(500).json({ 
        error: "Falha ao extrair texto da imagem via Inteligência Artificial: " + (err.message || "Erro de Conexão") 
      });
    }
  });

  // API Route: AI Action
  app.post("/api/ai/action", async (req, res) => {
    const { action, topic, subject, contextText, studentName, week, performanceData, difficulty, year, banca } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "A chave de API do Gemini (GEMINI_API_KEY) não está configurada no servidor. Por favor, configure-a no painel de Configurações > Secrets da plataforma AI Studio." 
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = "Você é o Mentor de Estudos IA, um professor e pedagogo especialista em preparação de alto rendimento para concursos públicos (CFO e Soldado PMBA). Seu tom de voz é estritamente profissional, didático, acolhedor e focado no ensino passo a passo detalhado, sem o uso de jargões militares, referências bélicas ou termos como 'recruta', 'soldado', 'batalha' ou 'combate'. Suas explicações devem ser claras, estruturadas, baseadas estritamente na lei e jurisprudência, usando formatações impecáveis com Markdown, tabelas, tópicos claros e mnemônicos pedagógicos para facilitar o aprendizado e a memorização.";
      let prompt = "";
      let responseSchema: any = undefined;

      if (action === "explain") {
        prompt = `Explique detalhadamente o assunto "${topic}" dentro da disciplina de "${subject}". \n\n${contextText ? `Dúvida específica ou questão do aluno: ${contextText}\n\n` : ""}Por favor, inclua:\n1. Conceito principal e base jurídica/teórica aplicável\n2. Pontos de atenção e possíveis pegadinhas que a banca costuma cobrar nos concursos de Oficial (CFO) e Soldado da Bahia\n3. Um exemplo prático ou mnemônico didático passo a passo para fixação absoluta.`;
      } else if (action === "summarize") {
        prompt = `Monte um resumo estratégico e didático estruturado passo a passo de alta memorização para o assunto "${topic}" da disciplina de "${subject}". \n\nEstruture o resumo com tópicos claros, tabelas em Markdown e mnemônicos pedagógicos de fixação rápida. Ao final, inclua uma seção "Checklist dos 5 Pontos de Ouro" indispensáveis para revisar na véspera da prova.`;
      } else if (action === "questions") {
        prompt = `Gere exatamente 20 questões semelhantes de múltipla escolha focadas no concurso da PMBA para o assunto "${topic}" da disciplina de "${subject}". \n\nAs questões devem cobrir o nível exigido para os concursos da Bahia. Para cada questão:\n- Insira o enunciado claro com 5 alternativas (A, B, C, D, E).\n- Logo após cada questão, inclua o Gabarito Comentado didático explicativo justificando passo a passo por que a resposta correta é aquela e por que as outras estão incorretas.\n\nFormate as questões de forma legível e numerada de 1 a 20.`;
      } else if (action === "flashcards") {
        prompt = `Gere uma série de Flashcards de estudo estratégico de memorização ativa para o assunto "${topic}" dentro da disciplina de "${subject}", focados nas exigências e na cobrança típica do concurso CFO/Soldado PMBA. 
        
        Gere exatamente 8 a 10 flashcards de alta qualidade.
        Para cada flashcard, você DEVE formatá-lo RIGOROSAMENTE conforme o modelo abaixo, usando "Frente:" e "Verso:" para que nosso sistema possa lê-los e exibi-los em cartões interativos que giram na tela:

        ---
        Frente: [Sua pergunta cirúrgica sobre lei seca, jurisprudência, prazos ou conceitos fundamentais aqui]
        Verso: [Sua resposta objetiva, didática e direta fundamentada pedagogicamente aqui]
        ---

        Exemplo de formato:
        ---
        Frente: Qual o prazo prescricional para a ação disciplinar de demissão no estatuto dos funcionários civis aplicável por analogia ou lei estadual específica da Bahia?
        Verso: O prazo de prescrição é de 5 anos para as infrações puníveis com demissão, cassação de aposentadoria ou disponibilidade.
        ---

        Certifique-se de que cada flashcard seja separado por uma linha "---" e use exatamente as tags "Frente:" e "Verso:".`;
      } else if (action === "ask_doubt") {
        prompt = `Responda de forma extremamente didática, atenciosa e esclarecedora à seguinte dúvida conceitual ou análise de questão enviada pelo aluno sobre o assunto "${topic}" da disciplina de "${subject}":
        
        ---
        DÚVIDA / QUESTÃO DO ALUNO:
        "${contextText || "Por favor, explique os pontos mais difíceis deste assunto."}"
        ---
        
        Por favor:
        1. Desmantele a dúvida passo a passo, explicando o conceito de forma simples, objetiva e livre de jargões bélicos desnecessários.
        2. Se for uma questão colada pelo aluno, indique qual é a resposta correta, explicando o erro das demais e fundamentando diretamente nos artigos de lei (Constituição, Código Penal, Estatuto da PMBA, etc.).
        3. Forneça uma dica de memorização, mnemônico pedagógico ou macete prático para o aluno nunca mais esquecer este assunto e garantir seu ponto na prova.`;
      } else if (action === "generate_report") {
        prompt = `Você é o Mentor de Estudos IA, coordenador pedagógico e tutor de alto rendimento. Redija um relatório de desempenho semanal personalizado e detalhado para o aluno "${studentName || "Estudante"}" na semana de número ${week || "atual"}. 
        Use um tom altamente profissional, didático, focado na aprovação, estimulante e estratégico, sem jargões militares ou termos como 'recruta', 'tático' ou 'diretriz militar'. 
        Analise o histórico de questões e progresso do estudante relatado abaixo:
        ---
        ${performanceData || "Nenhum histórico lançado nesta semana."}
        ---
        Seu relatório de parecer pedagógico deve avaliar as áreas em que o aluno está tendo um bom rendimento e destacar onde ele precisa focar com urgência (qualquer disciplina com aproveitamento inferior a 75% deve ser apontada como atenção recomendada). Dê conselhos didáticos e práticos de estudo passo a passo (revisão de lei seca, de resumos, e revisão de erros) e termine com uma orientação motivacional e pedagógica de impacto. 
        Retorne APENAS o relatório em formato de texto limpo, sem cabeçalhos genéricos repetitivos, sem tags de imagem, e sem tags HTML de quebra de linha. Utilize parágrafos simples e limpos.`;
      } else if (action === "generate_question") {
        const isTextInterpretation = 
          (subject || "").toLowerCase().includes("portuguesa") && 
          ((topic || "").toLowerCase().includes("interpretação") || 
           (topic || "").toLowerCase().includes("compreensão") || 
           (topic || "").toLowerCase().includes("texto") || 
           (topic || "").toLowerCase().includes("gêneros") || 
           (topic || "").toLowerCase().includes("tipologia") || 
           (topic || "").toLowerCase().includes("leitura"));

        let textInterpretationInstruction = "";
        if (isTextInterpretation) {
          textInterpretationInstruction = `\n\nIMPORTANTE (Interpretação de Texto): Como esta questão é de Interpretação/Compreensão de Texto em Língua Portuguesa, você DEVE incluir no campo "statement", ANTES do enunciado da pergunta, um TEXTO LONGO, rico e completo de suporte (com pelo menos 3 a 5 parágrafos densos e completos, abordando temas relevantes como segurança pública, ética militar, história da Bahia, cidadania ou sociedade). O candidato precisa obrigatoriamente ler esse texto longo de suporte para conseguir interpretar e responder à questão. Formate o texto longo com quebras de linha duplas para separá-lo do enunciado da pergunta que virá a seguir.`;
        }

        prompt = `Gere uma nova e inédita questão de concurso público de múltipla escolha focada no concurso de Oficial (CFO) ou de Soldado da Polícia Militar da Bahia (PMBA).
        
        Disciplina: "${subject}"
        Assunto: "${topic}"
        Dificuldade da questão: "${difficulty || "Média"}"
        Ano de simulação: "${year || "2026"}"
        Banca de simulação: "${banca || "IBFC"}"${textInterpretationInstruction}

        REQUISITOS ESSENCIAIS DE QUALIDADE E REPERTÓRIO:
        1. REPERTÓRIO RICO E DIVERSIFICADO: Não se limite a apenas citar "PMBA" de forma monótona ou rasa. Formule casos práticos realistas, ocorrências policiais simuladas, cenários do cotidiano de patrulhamento da PM, inquéritos militares, crimes militares, dilemas de Direitos Humanos aplicados e discussões jurídicas de alto nível no contexto da legislação baiana ou federal pertinente. Varie as referências institucionais, usando termos como "Policial Militar do Estado da Bahia", "Guarnição da PM", "Oficial da Polícia Militar", "soldado de 1ª classe", "comandante de companhia", etc.
        2. FOCO CIRÚRGICO NA BANCA ${banca || "IBFC"}: A questão deve simular fielmente o estilo e o nível de profundidade cobrados pela banca, contendo alternativas verossímeis e muito bem elaboradas.
        3. RESTRIÇÃO DE FORMATAÇÃO: NÃO utilize nenhum tipo de marcação em markdown (como asteriscos '*' ou '**') nos campos "statement" e "options". Os enunciados e as alternativas de resposta devem ser puramente em texto limpo.
        4. EXPLICAÇÃO RICA E COLORIDA: No campo "explanation", utilize mnemônicos, artigos da lei ou doutrina explicada. Sinta-se à vontade para usar formatação em markdown (como '**' para negrito e '*' para itálico) e as tags especiais de destaque de cores para guiar o aprendizado do aluno:
           - Use [VERDE: texto] para destacar a resposta correta, trechos corretos de leis ou doutrinas.
           - Use [VERMELHO: texto] para destacar pegadinhas da banca, erros comuns ou trechos proibidos/inconstitucionais.
           - Use [AMARELO: texto] para pontos de atenção ou mnemônicos importantes.
           - Use [AZUL: texto] para artigos de lei, súmulas ou jurisprudência citada.

        Você DEVE responder com um JSON válido correspondente à seguinte estrutura de dados:
        {
          "statement": "O enunciado da questão aqui...",
          "options": [
            "Texto completo da alternativa A",
            "Texto completo da alternativa B",
            "Texto completo da alternativa C",
            "Texto completo da alternativa D",
            "Texto completo da alternativa E"
          ],
          "correctOptionIndex": 0, // Número de 0 a 4 que indica qual alternativa é a correta
          "explanation": "Fundamentação jurídica e explicação detalhada do gabarito oficial com formatação e tags de cores..."
        }

        Retorne APENAS o objeto JSON puro, sem blocos de código markdown ou texto explicativo extra, pois o servidor irá ler o conteúdo com JSON.parse diretamente.`;
        
        responseSchema = {
          type: "OBJECT",
          properties: {
            statement: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            correctOptionIndex: { type: "INTEGER" },
            explanation: { type: "STRING" }
          },
          required: ["statement", "options", "correctOptionIndex", "explanation"]
        };
      } else {
        return res.status(400).json({ error: "Ação de IA inválida" });
      }

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: action === "generate_question" ? 0.4 : 0.2,
          responseMimeType: action === "generate_question" ? "application/json" : undefined,
          responseSchema: responseSchema,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Erro no processamento da IA:", err);
      res.status(500).json({ 
        error: "Falha ao consultar a Inteligência Artificial do Mentor de Estudos IA: " + (err.message || "Erro de Conexão") 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
