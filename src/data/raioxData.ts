export interface RaioXTopic {
  topic: string;
  incidence: number;
  howItFalls: string;
  articles?: string;
}

export interface RaioXSubject {
  subject: string;
  questionsPerExam: string;
  topics: RaioXTopic[];
}

export interface Top15Item {
  rank: number;
  topic: string;
  subject: string;
  incidence: number;
  articles: string;
}

export const raioXSoldadoData: RaioXSubject[] = [
  {
    subject: "Língua Portuguesa",
    questionsPerExam: "~10 questões/prova",
    topics: [
      {
        topic: "Interpretação de texto",
        incidence: 22,
        howItFalls: "Ideia central, inferências, sentido de palavra/expressão no contexto, gênero textual (crônica, artigo), posição do autor."
      },
      {
        topic: "Regência verbal e crase",
        incidence: 10,
        howItFalls: "Verbo exige preposição? Há crase? Verbos frequentes: assistir, preferir, informar, obedecer."
      },
      {
        topic: "Pontuação",
        incidence: 8,
        howItFalls: "Vírgula (separar termos, orações, vocativo, aposto). Dois-pontos (explicação/citação) e travessão."
      },
      {
        topic: "Concordância verbal/nominal",
        incidence: 7,
        howItFalls: "Casos especiais: havia (singular), faz com tempo (singular), mais de um, um dos que (plural)."
      },
      {
        topic: "Vozes verbais",
        incidence: 5,
        howItFalls: "Transformar ativa em passiva (analítica e sintética). Identificar sujeito paciente."
      },
      {
        topic: "Pronomes e colocação",
        incidence: 5,
        howItFalls: "Referência do pronome (lhe, o, se) e colocação pronominal (próclise, ênclise, mesóclise) no texto."
      },
      {
        topic: "Ortografia/acentuação",
        incidence: 3,
        howItFalls: "Hífen em compostos (micro-ônibus, contra-ataque). Acentuação de oxítonas, paroxítonas, proparoxítonas."
      }
    ]
  },
  {
    subject: "Matemática / Raciocínio Lógico",
    questionsPerExam: "~8 questões/prova",
    topics: [
      {
        topic: "Problemas com conjuntos (Venn)",
        incidence: 6,
        howItFalls: "Dois ou três conjuntos. Ex.: '30 gostam de A, 20 de B, 8 de ambos. Quantos não gostam de nenhum?'"
      },
      {
        topic: "Problemas matemáticos (%, regra de três, idades)",
        incidence: 6,
        howItFalls: "Interpretação de problemas cotidianos. Calcular porcentagem. Descobrir idade com base em pistas."
      },
      {
        topic: "Análise combinatória e probabilidade",
        incidence: 5,
        howItFalls: "Arranjos e permutações (ex.: '4 livros em 10 espaços'). Probabilidade de sorteios."
      },
      {
        topic: "Equações e sistemas",
        incidence: 4,
        howItFalls: "Problemas que geram equação de 1º grau ou sistema com duas incógnitas (ex.: preço de camisa e calça)."
      },
      {
        topic: "Geometria (volume, área)",
        incidence: 2,
        howItFalls: "Apareceu apenas na prova FCC/2023. Volume de cubo e pirâmide (razão entre volumes) e área de retângulo com triângulos."
      }
    ]
  },
  {
    subject: "História do Brasil",
    questionsPerExam: "~8 questões/prova",
    topics: [
      {
        topic: "Revoltas na Bahia",
        incidence: 7,
        howItFalls: "Conjuração Baiana (1798), Sabinada (1837), Revolta dos Malês (1835). Causas, líderes e desfecho."
      },
      {
        topic: "Guerra de Canudos",
        incidence: 6,
        howItFalls: "Liderança de Antônio Conselheiro, contexto de seca e latifúndio, confronto com o Exército (1896-1897)."
      },
      {
        topic: "Era Vargas",
        incidence: 6,
        howItFalls: "Estado Novo: Constituição de 1937, DIP (censura/propaganda), CLT. Política externa na 2ª Guerra."
      },
      {
        topic: "Período colonial",
        incidence: 5,
        howItFalls: "Ciclo do açúcar (engenhos, escravidão) e mineração (Guerra dos Emboabas)."
      },
      {
        topic: "Regime Militar",
        incidence: 5,
        howItFalls: "'Milagre econômico' (1968-73) com concentração de renda, AI-5, transição (Diretas Já)."
      },
      {
        topic: "Independência do Brasil",
        incidence: 4,
        howItFalls: "Fatores externos/internos e atuação da Bahia na expulsão dos portugueses (2 de julho de 1823)."
      }
    ]
  },
  {
    subject: "Geografia do Brasil",
    questionsPerExam: "~8 questões/prova",
    topics: [
      {
        topic: "Geografia da Bahia",
        incidence: 12,
        howItFalls: "Biomas: Cerrado, Caatinga, Mata Atlântica. Hidrografia: bacia do São Francisco, usina de Sobradinho. Relevo: Chapada Diamantina. Economia: expansão da soja/algodão no Oeste baiano."
      },
      {
        topic: "Clima e vegetação do Brasil",
        incidence: 8,
        howItFalls: "Semiárido (Caatinga) – chuvas irregulares. Tropical (Cerrado) – inverno seco. Brisas marítimas/terrestres."
      },
      {
        topic: "Questões ambientais",
        incidence: 6,
        howItFalls: "Desmatamento da Caatinga para lenha/carvão. Vazamento de óleo no litoral nordestino (2019). Impactos de barragens (Sobradinho)."
      },
      {
        topic: "Relevo brasileiro",
        incidence: 5,
        howItFalls: "Classificação de Jurandir Ross: planaltos (erosão), planícies (sedimentação), depressões (rebaixamento)."
      },
      {
        topic: "Demografia e urbanização",
        incidence: 5,
        howItFalls: "Cidades milionárias, distribuição populacional, autodeclaração racial na Bahia (IBGE)."
      }
    ]
  },
  {
    subject: "Atualidades",
    questionsPerExam: "~8 questões/prova",
    topics: [
      {
        topic: "Política internacional",
        incidence: 10,
        howItFalls: "Brexit, crise na Venezuela (imigração para Roraima), eleição francesa (Macron x Le Pen), tensão com Irã (enriquecimento de urânio), conflitos no Afeganistão."
      },
      {
        topic: "Política brasileira",
        incidence: 8,
        howItFalls: "Lava Jato, Lei da Ficha Limpa, decisões do STF (criminalização da homofobia e racismo), impeachment de Dilma."
      },
      {
        topic: "Meio ambiente",
        incidence: 6,
        howItFalls: "Vazamento de óleo no Nordeste (2019), queimadas na Amazônia, Acordo de Paris."
      },
      {
        topic: "Tecnologia e sociedade",
        incidence: 5,
        howItFalls: "Compra do Twitter por Musk, inteligência artificial, 'telefone burro'."
      },
      {
        topic: "Cultura e eventos",
        incidence: 5,
        howItFalls: "Grammy Latino para Linn da Quebrada, blocos afro da Bahia, polêmicas da Copa do Catar."
      }
    ]
  },
  {
    subject: "Informática",
    questionsPerExam: "~8 questões/prova",
    topics: [
      {
        topic: "Excel/Calc (fórmulas)",
        incidence: 12,
        howItFalls: "SOMASE (soma com critério), ARRED, MÉDIA, SE. Sintaxe: dois-pontos para intervalo, ponto-e-vírgula para separar argumentos."
      },
      {
        topic: "Windows e atalhos",
        incidence: 8,
        howItFalls: "Gerenciador de Tarefas (Ctrl+Alt+Del), ipconfig, Alt+F4 (fechar janela), Lixeira."
      },
      {
        topic: "E-mail e internet",
        incidence: 8,
        howItFalls: "Cco (ocultar destinatários), intranet, armazenamento em nuvem (Dropbox, Google Drive)."
      },
      {
        topic: "Word/Linux",
        incidence: 6,
        howItFalls: "Alt+F4 no Word, Tab para avançar nível em lista, mkdir no Linux, Slide Mestre no LibreOffice Impress."
      }
    ]
  },
  {
    subject: "Direito Constitucional",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Segurança Pública",
        incidence: 8,
        howItFalls: "Atribuições: PF (judiciária da União), PRF (rodovias), PC (judiciária estadual), PM (polícia ostensiva).",
        articles: "Art. 144 da CF/88"
      },
      {
        topic: "Servidor público",
        incidence: 7,
        howItFalls: "Princípios (legalidade, impessoalidade, moralidade, publicidade, eficiência) e estabilidade (3 anos).",
        articles: "Arts. 37 a 41 da CF/88 (Art. 37 citado na prova de 2017)"
      },
      {
        topic: "Direitos fundamentais",
        incidence: 5,
        howItFalls: "Prisão civil (vedada, exceto devedor de alimentos). Nacionalidade (brasileiro nato).",
        articles: "Art. 5º, LXVII e Art. 12 da CF/88"
      },
      {
        topic: "Remédios constitucionais",
        incidence: 4,
        howItFalls: "Mandado de segurança, habeas corpus, habeas data - diferenças e aplicação.",
        articles: "Art. 5º, LXIX, LXVIII e LXXII da CF/88"
      },
      {
        topic: "Organização dos Poderes",
        incidence: 4,
        howItFalls: "Linha sucessória da Presidência (Vice → Câmara → Senado → STF).",
        articles: "Art. 79 da CF/88"
      },
      {
        topic: "Constituição do Estado da Bahia",
        incidence: 3,
        howItFalls: "Atribuições do Governador, Defensoria Pública, Justiça Militar estadual.",
        articles: "Arts. 105, 106, 131 da CE/BA"
      }
    ]
  },
  {
    subject: "Direitos Humanos",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Declaração Universal (1948)",
        incidence: 10,
        howItFalls: "Presunção de inocência, liberdade de locomoção, proibição da escravidão, liberdade de pensamento e religião, asilo político.",
        articles: "Arts. 5º, 11, 13, 14 da DUDH"
      },
      {
        topic: "Pacto de San José (1969)",
        incidence: 8,
        howItFalls: "Direito à vida e restrições à pena de morte. Recurso simples e rápido contra violação de direitos.",
        articles: "Arts. 4º, 25 do Pacto de San José"
      },
      {
        topic: "Pacto Internacional dos Direitos Civis e Políticos (1966)",
        incidence: 7,
        howItFalls: "Direito de não depor contra si mesmo. Direito de sair de qualquer país (inclusive o próprio).",
        articles: "Arts. 14, 12 do PIDCP"
      }
    ]
  },
  {
    subject: "Direito Administrativo",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Estatuto dos PMs (Lei 7.990/2001)",
        incidence: 8,
        howItFalls: "Provimento: nomeação e reintegração. Hierarquia: Postos e Graduações. Penalidades.",
        articles: "Arts. 4º, 5º, 6º, 11, 12 da Lei 7.990/2001"
      },
      {
        topic: "Princípios da Administração Pública",
        incidence: 8,
        howItFalls: "Impessoalidade (vedação à promoção pessoal em publicidade). Legalidade, Publicidade.",
        articles: "Art. 37, caput e §1º da CF/88"
      },
      {
        topic: "Atributos dos atos administrativos",
        incidence: 7,
        howItFalls: "Presunção de veracidade, autoexecutoriedade, imperatividade.",
        articles: "—"
      },
      {
        topic: "Poder de polícia",
        incidence: 5,
        howItFalls: "Polícia Administrativa x Polícia Judiciária.",
        articles: "—"
      }
    ]
  },
  {
    subject: "Direito Penal",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Excludentes de ilicitude",
        incidence: 10,
        howItFalls: "Legítima defesa, estado de necessidade, exercício regular de direito, estrito cumprimento do dever legal.",
        articles: "Art. 23 do CP"
      },
      {
        topic: "Crimes contra a Administração Pública",
        incidence: 6,
        howItFalls: "Corrupção Ativa/Passiva, Concussão, Peculato.",
        articles: "Arts. 317, 333, 316, 312 do CP"
      },
      {
        topic: "Crimes contra o patrimônio",
        incidence: 6,
        howItFalls: "Furto, Roubo, Estelionato, Receptação.",
        articles: "Arts. 155, 157, 171, 180 do CP"
      },
      {
        topic: "Homicídio e importunação sexual",
        incidence: 4,
        howItFalls: "Homicídio qualificado. Importunação sexual.",
        articles: "Art. 121, §2º e Art. 215-A do CP"
      },
      {
        topic: "Tortura (Lei 9.455/97)",
        incidence: 3,
        howItFalls: "Constranger com violência/ameaça para obter informação/confissão.",
        articles: "Art. 1º, inciso I da Lei 9.455/97"
      },
      {
        topic: "Aplicação da lei penal",
        incidence: 2,
        howItFalls: "Abolitio criminis, Novatio legis in mellius.",
        articles: "Art. 2º do CP"
      },
      {
        topic: "Drogas (Lei 11.343/06)",
        incidence: 2,
        howItFalls: "Porte para consumo pessoal - penas alternativas.",
        articles: "Art. 28 da Lei 11.343/06"
      }
    ]
  },
  {
    subject: "Direito Penal Militar",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Motim e Revolta",
        incidence: 10,
        howItFalls: "Reunião de militares para recusar obediência ou praticar violência. Aliciamento.",
        articles: "Arts. 149, 150 e 152 do CPM"
      },
      {
        topic: "Deserção e Abandono de Posto",
        incidence: 8,
        howItFalls: "Deserção: ausentar-se por mais de 8 dias. Abandono de Posto. Agravantes: fronteira ou país estrangeiro.",
        articles: "Arts. 187 e 195 do CPM"
      },
      {
        topic: "Desacato a Superior e a Militar",
        incidence: 7,
        howItFalls: "Ofender a dignidade ou o decoro de superior ou de outro militar.",
        articles: "Arts. 160 e 161 do CPM"
      },
      {
        topic: "Peculato e Prevaricação",
        incidence: 5,
        howItFalls: "Peculato: apropriar-se ou desviar bem público. Prevaricação: retardar ato de ofício por interesse pessoal.",
        articles: "Arts. 303 e 319 do CPM"
      },
      {
        topic: "Recusa de Obediência e Resistência",
        incidence: 4,
        howItFalls: "Recusar ordem de superior. Opor-se à execução de ato legal.",
        articles: "Arts. 163 e 164 do CPM"
      },
      {
        topic: "Violência contra superior / militar de serviço",
        incidence: 3,
        howItFalls: "Praticar violência contra superior, oficial de dia, sentinela, etc.",
        articles: "Art. 157 do CPM"
      }
    ]
  },
  {
    subject: "Igualdade Racial e de Gênero",
    questionsPerExam: "~5 questões/prova",
    topics: [
      {
        topic: "Lei Maria da Penha (11.340/2006)",
        incidence: 9,
        howItFalls: "Formas de violência: Física, Psicológica, Moral, Patrimonial, Sexual. Medidas protetivas.",
        articles: "Arts. 5º, 7º, 22, 38 da Lei 11.340/06"
      },
      {
        topic: "Estatuto da Igualdade Racial (12.288/2010)",
        incidence: 8,
        howItFalls: "Definição de discriminação racial e desigualdade racial. Liberdade de culto das religiões de matriz africana.",
        articles: "Arts. 1º, 2º, 4º, 20 da Lei 12.288/10"
      },
      {
        topic: "Lei do Racismo (7.716/1989) e Injúria Racial",
        incidence: 6,
        howItFalls: "Racismo: inafiançável e imprescritível. Injúria Racial (art. 140, §3º, CP).",
        articles: "Art. 1º da Lei 7.716/89 e Art. 140, §3º do CP"
      },
      {
        topic: "Genocídio (Lei 2.889/1956)",
        incidence: 3,
        howItFalls: "Intenção de destruir grupo nacional, étnico, racial ou religioso.",
        articles: "Art. 1º da Lei 2.889/56"
      },
      {
        topic: "Lei Caó (7.437/1985)",
        incidence: 2,
        howItFalls: "Crimes de preconceito – penas adicionais para reincidência.",
        articles: "Art. 3º da Lei 7.437/85"
      }
    ]
  }
];

export const top15Incidence: Top15Item[] = [
  { rank: 1, topic: "Interpretação de Texto", subject: "Língua Portuguesa", incidence: 22, articles: "—" },
  { rank: 2, topic: "Geografia da Bahia", subject: "Geografia do Brasil", incidence: 12, articles: "—" },
  { rank: 3, topic: "Excel/Calc (fórmulas)", subject: "Informática", incidence: 12, articles: "—" },
  { rank: 4, topic: "Motim e Revolta", subject: "Direito Penal Militar", incidence: 10, articles: "Arts. 149, 150, 152 CPM" },
  { rank: 5, topic: "Excludentes de Ilicitude", subject: "Direito Penal", incidence: 10, articles: "Art. 23 CP" },
  { rank: 6, topic: "Declaração Universal dos Direitos Humanos", subject: "Direitos Humanos", incidence: 10, articles: "Arts. 5º, 11, 13, 14 DUDH" },
  { rank: 7, topic: "Política Internacional", subject: "Atualidades", incidence: 10, articles: "—" },
  { rank: 8, topic: "Regência verbal e crase", subject: "Língua Portuguesa", incidence: 10, articles: "—" },
  { rank: 9, topic: "Lei Maria da Penha", subject: "Igualdade Racial e de Gênero", incidence: 9, articles: "Arts. 5º, 7º, 22, 38 Lei 11.340/06" },
  { rank: 10, topic: "Pontuação", subject: "Língua Portuguesa", incidence: 8, articles: "—" },
  { rank: 11, topic: "Segurança Pública (art. 144)", subject: "Direito Constitucional", incidence: 8, articles: "Art. 144 CF/88" },
  { rank: 12, topic: "Estatuto dos PMs", subject: "Direito Administrativo", incidence: 8, articles: "Arts. 4º, 5º, 6º, 11, 12 Lei 7.990/2001" },
  { rank: 13, topic: "Deserção e Abandono de Posto", subject: "Direito Penal Militar", incidence: 8, articles: "Arts. 187, 195 CPM" },
  { rank: 14, topic: "Revoltas na Bahia", subject: "História do Brasil", incidence: 7, articles: "—" },
  { rank: 15, topic: "Concordância verbal/nominal", subject: "Língua Portuguesa", incidence: 7, articles: "—" }
];

export const raioXCfoData: RaioXSubject[] = [
  {
    subject: "Língua Portuguesa",
    questionsPerExam: "20 questões/prova",
    topics: [
      { topic: "Interpretação de Texto (tese, ideias, inferências)", incidence: 7, howItFalls: "Perguntas sobre a mensagem central, posicionamento do autor, estratégias argumentativas. Textos sobre ética, segurança, comportamento social." },
      { topic: "Crase", incidence: 2, howItFalls: "Uso obrigatório (regência + artigo), facultativo (antes de possessivos) ou vedado (antes de masculino/verbo)." },
      { topic: "Concordância Verbal/Nominal", incidence: 2, howItFalls: "Sujeito composto/simples, adjetivos em posição predicativa ou adjunta, coletivos." },
      { topic: "Regência (Verbal/Nominal)", incidence: 2, howItFalls: "Transitividade direta/indireta, complementos preposicionados (ex: verbo 'atrair', nome 'acesso')." },
      { topic: "Colocação Pronominal", incidence: 1, howItFalls: "Próclise (atração por advérbios), ênclise (início de frase), mesóclise (futuro)." },
      { topic: "Tipos de Discurso", incidence: 1, howItFalls: "Identificar discurso direto (aspas), indireto (mediação do narrador), indireto livre." },
      { topic: "Pontuação", incidence: 2, howItFalls: "Vírgula para apostos/orações intercaladas, dois-pontos para explicação, travessão para destaque." },
      { topic: "Classes de Palavras / Morfologia", incidence: 2, howItFalls: "Advérbios (circunstâncias de tempo/modo/intensidade), conjunções (adversativas, explicativas), pronomes." },
      { topic: "Redação e Correspondência Oficial", incidence: 2, howItFalls: "Finalidade e diferenças entre Ofício (externo, formal) e Memorando (interno, ágil); impessoalidade, clareza, concisão." }
    ]
  },
  {
    subject: "Língua Inglesa",
    questionsPerExam: "5 questões/prova",
    topics: [
      { topic: "Interpretação de Texto (notícias curtas)", incidence: 3, howItFalls: "Perguntas sobre ideia principal, detalhes específicos (quem, quando, onde) e inferências (BBC/The Guardian)." },
      { topic: "Substantivos Contáveis/Incontáveis", incidence: 1, howItFalls: "Identificação de itens como 'milk', 'information' (incontáveis) vs. 'car', 'book' (contáveis)." },
      { topic: "Ordem dos Advérbios", incidence: 1, howItFalls: "Correta colocação dos advérbios de modo, lugar, tempo e intensidade (Manner-Place-Time)." },
      { topic: "Sinônimos e Antônimos", incidence: 1, howItFalls: "Pares de palavras com sentido equivalente (Expand-Enlarge) ou oposto." },
      { topic: "Preposições", incidence: 1, howItFalls: "Uso após adjetivos ('good at') e verbos." },
      { topic: "Tempos e Modais Verbais", incidence: 2, howItFalls: "Simple Past (ações concluídas), Present Perfect, 'should' (conselho) e 'will' (futuro)." }
    ]
  },
  {
    subject: "História do Brasil",
    questionsPerExam: "~6 a 8 questões/prova",
    topics: [
      { topic: "Brasil Colônia e Império", incidence: 2, howItFalls: "Expansão territorial (pecuária, mineração), valor do couro, Primeiro Reinado, Constituição de 1824." },
      { topic: "Revoltas e Movimentos Sociais (século XIX)", incidence: 2, howItFalls: "Canudos (caráter messiânico, Antônio Conselheiro), Sabinada, Balaiada, Malês, Farroupilha (causas e contextos)." },
      { topic: "Independência da Bahia", incidence: 1, howItFalls: "Caráter popular (caboclos), diferenças em relação ao resto do Brasil, participação de negros e índios." },
      { topic: "República Velha e Era Vargas", incidence: 2, howItFalls: "Política dos Governadores, Revolta da Vacina, criação de estatais (CSN), contraste entre regiões." },
      { topic: "Ditadura Militar (1964-1985)", incidence: 1, howItFalls: "Atos Institucionais (AI-5), censura, repressão, visões revisionistas ('golpe' vs 'revolução')." }
    ]
  },
  {
    subject: "História Geral",
    questionsPerExam: "~2 a 3 questões/prova",
    topics: [
      { topic: "Antiguidade (Etruscos)", incidence: 1, howItFalls: "Influência na civilização romana, organização política, religião, escrita." },
      { topic: "Idade Média (Cruzadas)", incidence: 1, howItFalls: "Contexto religioso, interesses comerciais, impactos no Renascimento." },
      { topic: "Reforma Protestante (Calvinismo)", incidence: 1, howItFalls: "Doutrina da predestinação, influência social e econômica, diferenças do catolicismo." },
      { topic: "Primeira Guerra Mundial (1914-1918)", incidence: 1, howItFalls: "Causas (nacionalismo, alianças, corrida armamentista, imperialismo)." },
      { topic: "Relações Internacionais / Conflitos Atuais", incidence: 2, howItFalls: "Crise na Venezuela, conflito na Síria, FARC (Colômbia), política externa dos EUA no Oriente Médio." }
    ]
  },
  {
    subject: "Geografia Geral e do Brasil",
    questionsPerExam: "~10 a 12 questões/prova",
    topics: [
      { topic: "Geografia Física do Brasil", incidence: 3, howItFalls: "Biomas (Amazônia, Cerrado, Caatinga), desmatamento, relevo (planaltos, planícies), bacias hidrográficas (Paraguaçu)." },
      { topic: "Urbanização e Migrações", incidence: 3, howItFalls: "Êxodo rural, favelização, concentração populacional no Sudeste, fluxos migratórios inter-regionais." },
      { topic: "Questão Agrária / Estrutura Fundiária", incidence: 2, howItFalls: "Latifúndio, minifúndio, concentração de terras, conflitos no campo." },
      { topic: "Meio Ambiente / Sustentabilidade", incidence: 2, howItFalls: "Mudanças climáticas, 'pegada ecológica', Rio+20, recursos hídricos, energias renováveis." },
      { topic: "Regionalização e Blocos Econômicos", incidence: 2, howItFalls: "Características das regiões do Brasil, União Europeia, MERCOSUL, NAFTA, ALCA." },
      { topic: "Geopolítica e Conflitos Atuais", incidence: 1, howItFalls: "Disputas por recursos (água, petróleo), conflitos na África (Somália, Quênia, Nigéria)." }
    ]
  },
  {
    subject: "Matemática",
    questionsPerExam: "10 questões/prova",
    topics: [
      { topic: "Probabilidade", incidence: 2, howItFalls: "Cálculo de eventos simples, complementar, combinações (ex: sorteio de postos, cartões)." },
      { topic: "Análise Combinatória", incidence: 2, howItFalls: "Anagramas com repetição de letras, combinações com restrições (distância do taxista)." },
      { topic: "Juros Simples e Compostos", incidence: 2, howItFalls: "Montante, capital, tempo (fórmula M = C(1+i)^t ou juros simples)." },
      { topic: "Funções (polinomiais, logarítmicas, exponenciais)", incidence: 2, howItFalls: "Cálculo de valor numérico, domínio, imagem (ex: função quadrática de custo, função exponencial)." },
      { topic: "Geometria Plana e Espacial", incidence: 2, howItFalls: "Área de triângulo/prisma/cilindro, volume (cone equilátero), relação entre figuras." },
      { topic: "Trigonometria", incidence: 1, howItFalls: "Identidade fundamental (sen²x+cos²x=1), tangente, razões no ciclo." },
      { topic: "Sistemas Lineares", incidence: 1, howItFalls: "Classificação (possível indeterminado = infinitas soluções)." },
      { topic: "Progressões Aritméticas e Geométricas", incidence: 1, howItFalls: "Termo geral, soma de termos (ex: PG para arrecadação com doações)." },
      { topic: "Matrizes e Determinantes", incidence: 1, howItFalls: "Comparação de determinantes de matrizes 3x3." }
    ]
  },
  {
    subject: "Informática",
    questionsPerExam: "5 questões/prova",
    topics: [
      { topic: "Internet vs Intranet", incidence: 1, howItFalls: "Diferenças (pública vs privada), aplicativos (e-mail, Google Drive)." },
      { topic: "Microsoft Word – Controlar Alterações", incidence: 1, howItFalls: "Revisão colaborativa, aceitar/rejeitar edições, rastreamento de mudanças." },
      { topic: "Malware – Ransomware", incidence: 1, howItFalls: "Criptografa arquivos e exige resgate (pagamento em criptomoeda)." },
      { topic: "Certificação e Assinatura Digital", incidence: 1, howItFalls: "Autoridade Certificadora (AC), chave pública/privada, integridade e autenticidade." },
      { topic: "Excel – Funções", incidence: 1, howItFalls: "=MAIOR(intervalo; k) para encontrar o k-ésimo maior valor." },
      { topic: "Linux – Comandos", incidence: 1, howItFalls: "mkdir (criar diretório)." },
      { topic: "Mecanismos de Busca", incidence: 1, howItFalls: "Modificadores filetype: (PDF) e site: (domínio específico)." }
    ]
  },
  {
    subject: "Direito Constitucional",
    questionsPerExam: "4 a 5 questões/prova",
    topics: [
      { topic: "Fundamentos da RFB", incidence: 1, howItFalls: "Soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e pluralismo político.", articles: "CF/88, Art. 1º" },
      { topic: "Princípios da Administração Pública", incidence: 2, howItFalls: "Legalidade, impessoalidade, moralidade, publicidade, eficiência.", articles: "CF/88, Art. 37" },
      { topic: "Direitos e Garantias Fundamentais", incidence: 2, howItFalls: "Igualdade, sigilo de correspondência, habeas corpus, inviolabilidade do lar.", articles: "CF/88, Art. 5º" },
      { topic: "Segurança Pública", incidence: 2, howItFalls: "Competências da PF, PRF, Polícias Civis e Militares, Corpos de Bombeiros.", articles: "CF/88, Art. 144" },
      { topic: "Forças Armadas", incidence: 1, howItFalls: "Missão de defesa da pátria e garantia da lei e da ordem.", articles: "CF/88, Art. 142" },
      { topic: "Militares dos Estados", incidence: 1, howItFalls: "Aplicação do Art. 142 aos militares estaduais (princípios gerais).", articles: "CF/88, Art. 42" }
    ]
  },
  {
    subject: "Direito Administrativo",
    questionsPerExam: "1 a 2 questões/prova",
    topics: [
      { topic: "Atos Administrativos", incidence: 2, howItFalls: "Atributos: presunção de legitimidade, imperatividade, autoexecutoriedade, tipicidade." },
      { topic: "Espécies de Atos", incidence: 1, howItFalls: "Atos ordinatórios (internos), negociais (consensuais), de gestão (coercitivos)." },
      { topic: "Controle da Administração", incidence: 1, howItFalls: "Controle legislativo (externo), judicial (legalidade) e interno." }
    ]
  },
  {
    subject: "Direito Penal",
    questionsPerExam: "4 a 5 questões/prova",
    topics: [
      { topic: "Feminicídio", incidence: 1, howItFalls: "Homicídio contra mulher por razão da condição de sexo feminino.", articles: "CP, Art. 121, §2º, VI" },
      { topic: "Lesão Corporal", incidence: 1, howItFalls: "Natureza grave (incapacidade > 30 dias), gravíssima.", articles: "CP, Art. 129" },
      { topic: "Tentativa / Arrependimento", incidence: 1, howItFalls: "Desistência voluntária (art. 15) vs arrependimento eficaz (impede o resultado).", articles: "CP, Arts. 14, 15" },
      { topic: "Crimes contra o Patrimônio", incidence: 2, howItFalls: "Furto (simples e qualificado – Art. 155), Roubo (Art. 157), Extorsão (Art. 158).", articles: "CP, Arts. 155, 157, 158" },
      { topic: "Crimes contra a Administração Pública", incidence: 2, howItFalls: "Corrupção passiva (Art. 317), Concussão (Art. 316), Prevaricação (Art. 319), Desacato (Art. 331).", articles: "CP, Arts. 316, 317, 319, 331" },
      { topic: "Ameaça", incidence: 1, howItFalls: "Crime contra a pessoa (art. 147).", articles: "CP, Art. 147" },
      { topic: "Abuso de autoridade", incidence: 1, howItFalls: "Sujeito ativo (autoridade pública), crimes em espécie e sanções.", articles: "Lei 13.869/19" }
    ]
  },
  {
    subject: "Direito Penal Militar",
    questionsPerExam: "2 a 3 questões/prova",
    topics: [
      { topic: "Embriaguez em serviço", incidence: 1, howItFalls: "Apresentar sinais de embriaguez comprovada por exame técnico.", articles: "CPM, Art. 202" },
      { topic: "Violência contra superior", incidence: 1, howItFalls: "Crime próprio; uso de arma aumenta a pena em 1/2.", articles: "CPM, Art. 157" },
      { topic: "Abandono de posto", incidence: 1, howItFalls: "Ausentar-se sem autorização (crime formal – não exige prejuízo).", articles: "CPM, Art. 196" },
      { topic: "Descumprimento de missão", incidence: 1, howItFalls: "Deixar de cumprir ordem ou missão.", articles: "CPM, Art. 195" },
      { topic: "Insubordinação", incidence: 1, howItFalls: "Recusar-se a cumprir ordem direta de superior.", articles: "CPM, Art. 163" },
      { topic: "Penas no CPM", incidence: 1, howItFalls: "Reforma, suspensão do exercício do posto e inabilitação.", articles: "CPM, Arts. 55 a 70" }
    ]
  },
  {
    subject: "Direitos Humanos",
    questionsPerExam: "4 a 5 questões/prova",
    topics: [
      { topic: "Declaração Universal dos DH (1948)", incidence: 2, howItFalls: "Igualdade, liberdade, segurança, asilo, nacionalidade, casamento, proibição de tortura.", articles: "DUDH: Arts. 1º, 3º, 6º, 10º, 12º, 16º" },
      { topic: "Pacto de San José (1969)", incidence: 2, howItFalls: "Audiência de custódia (Art. 7.5), recurso judicial (Art. 25), proibição de penas cruéis (Art. 5.2).", articles: "CADH: Arts. 5, 7, 8, 25" },
      { topic: "Convenção Discriminação Racial (1965)", incidence: 1, howItFalls: "Definição de discriminação; medidas para combater o preconceito.", articles: "Decreto 65.810/69" },
      { topic: "Convenção contra a Mulher (1979)", incidence: 1, howItFalls: "Medidas temporárias, participação política, nacionalidade, zona rural.", articles: "Decreto 4.377/02" },
      { topic: "Estatuto da Igualdade Racial (BA)", incidence: 1, howItFalls: "Reserva de 20% das vagas para negros por 20 anos; Dia da Consciência Negra (20/11).", articles: "Lei 13.182/2014" }
    ]
  },
  {
    subject: "Legislação Penal Especial",
    questionsPerExam: "2 a 3 questões/prova",
    topics: [
      { topic: "Lei de Drogas (11.343/06)", incidence: 1, howItFalls: "Tráfico (Art. 33), associação (Art. 35), redução de pena (§4º), transnacionalidade.", articles: "Lei 11.343/06: Arts. 33, 35, 40" },
      { topic: "Estatuto da Criança e Adolescente (ECA)", incidence: 1, howItFalls: "Guarda, adoção, aleitamento materno, direito à saúde.", articles: "Lei 8.069/90" },
      { topic: "Estatuto da Pessoa com Deficiência", incidence: 1, howItFalls: "Barreiras, adaptações razoáveis, mobiliário urbano, atendente pessoal.", articles: "Lei 13.146/15" },
      { topic: "Estatuto dos PMs da Bahia", incidence: 1, howItFalls: "Requisitos para ingresso (idade, estatura, idoneidade, escolaridade).", articles: "Lei 7.990/2001" },
      { topic: "Sistema Nacional de Armas (Sinarm)", incidence: 1, howItFalls: "Cadastro de armas, registro, transferência de propriedade.", articles: "Lei 10.826/03" }
    ]
  }
];

export const top15IncidenceCfo: Top15Item[] = [
  { rank: 1, topic: "Interpretação de Texto", subject: "Língua Portuguesa", incidence: 7, articles: "—" },
  { rank: 2, topic: "Interpretação de Texto (notícias)", subject: "Língua Inglesa", incidence: 3, articles: "—" },
  { rank: 3, topic: "Geografia Física do Brasil", subject: "Geografia Geral e do Brasil", incidence: 3, articles: "—" },
  { rank: 4, topic: "Urbanização e Migrações", subject: "Geografia Geral e do Brasil", incidence: 3, articles: "—" },
  { rank: 5, topic: "Revoltas e Movimentos Sociais", subject: "História do Brasil", incidence: 3, articles: "—" },
  { rank: 6, topic: "Princípios da Adm. Pública", subject: "Direito Constitucional", incidence: 2, articles: "CF/88, Art. 37" },
  { rank: 7, topic: "Direitos e Garantias Fundamentais", subject: "Direito Constitucional", incidence: 2, articles: "CF/88, Art. 5º" },
  { rank: 8, topic: "Segurança Pública", subject: "Direito Constitucional", incidence: 2, articles: "CF/88, Art. 144" },
  { rank: 9, topic: "Crimes contra o Patrimônio", subject: "Direito Penal", incidence: 2, articles: "CP, Arts. 155, 157, 158" },
  { rank: 10, topic: "Crimes contra a Adm. Pública", subject: "Direito Penal", incidence: 2, articles: "CP, Arts. 316, 317, 319, 331" },
  { rank: 11, topic: "Declaração Universal (DUDH)", subject: "Direitos Humanos", incidence: 2, articles: "DUDH: Arts. 1, 3, 6, 10, 12, 16" },
  { rank: 12, topic: "Pacto de San José (CADH)", subject: "Direitos Humanos", incidence: 2, articles: "CADH: Arts. 5, 7, 8, 25" },
  { rank: 13, topic: "Probabilidade", subject: "Matemática", incidence: 2, articles: "—" },
  { rank: 14, topic: "Crase", subject: "Língua Portuguesa", incidence: 2, articles: "—" },
  { rank: 15, topic: "Atos Administrativos", subject: "Direito Administrativo", incidence: 2, articles: "—" }
];
