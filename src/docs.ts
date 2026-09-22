/** Long-form descriptions of every dimension, shown in the help modal. */

export interface DimDoc {
  title: string;
  low: string;
  high: string;
  body: string;
}

export const HOFSTEDE_INTRO =
  "Geert Hofstede's model scores national cultures on six dimensions, each on a roughly 0–100 scale. " +
  "The first four come from IBM employee surveys (1967–1973) and later replication studies; Long Term Orientation and " +
  "Indulgence were added by Michael Minkov from World Values Survey data. Scores describe averages of a national population " +
  "and say nothing about individuals.";

export const HOFSTEDE_EDITIONS =
  "Two editions are available. 2015 is Hofstede's own last published data matrix (geerthofstede.com), unmodified. " +
  "2023 is the update published by The Culture Factor (formerly Hofstede Insights), which re-derived Individualism and " +
  "Long Term Orientation from newer Minkov–Kaasa surveys, renamed Masculinity, capped scores at 100 and added countries. " +
  "Because two of the six dimensions were re-measured with a different instrument, differences between editions mostly " +
  "reflect the change of method rather than cultural change.";

export const HOFSTEDE_DOCS: Record<string, DimDoc> = {
  pdi: {
    title: "Power Distance (PDI)",
    low: "hierarchy is a convenience, subordinates expect to be consulted, privileges are frowned upon.",
    high: "inequality is accepted as natural, power is centralised, subordinates expect to be told what to do.",
    body: "The extent to which the less powerful members of institutions and organisations accept and expect that power is distributed unequally. Measured from the perspective of the less powerful.",
  },
  idv: {
    title: "Individualism vs Collectivism (IDV)",
    low: "Collectivist: people belong to strong in-groups (extended family, clan) that protect them in exchange for loyalty; identity is rooted in the group.",
    high: "Individualist: ties between individuals are loose, everyone is expected to look after themselves and their immediate family; identity is rooted in the person.",
    body: "The degree to which people are integrated into groups. This is the dimension that separates Western Europe and the Anglosphere most sharply from the rest of the world. In the 2023 edition it was re-derived from Minkov's IDV–COLL index.",
  },
  mas: {
    title: "Motivation towards Achievement and Success (MAS), formerly Masculinity vs Femininity",
    low: "Consensus-oriented (\"feminine\"): caring for others and quality of life are the dominant values; status is not shown off.",
    high: "Achievement-oriented (\"masculine\"): competition, achievement and success define worth; the winner takes all.",
    body: "What motivates people: wanting to be the best (achievement) versus liking what you do (consensus). Renamed in 2023 to avoid the gendered wording; the underlying scores are the same construct.",
  },
  uai: {
    title: "Uncertainty Avoidance (UAI)",
    low: "ambiguity is tolerated, rules are kept to a minimum, deviance is accepted, practice counts more than principles.",
    high: "the unknown is threatening, there is an emotional need for rules and formal structure, and a belief in absolute truths.",
    body: "How much a society feels threatened by ambiguous or unknown situations and tries to avoid them. Not the same as risk avoidance: high-UAI cultures may take risks to reduce ambiguity.",
  },
  lto: {
    title: "Long Term Orientation (LTO), also Long- vs Short-Term Normative Orientation",
    low: "Short-term (normative): respect for tradition, keeping face, fulfilling social obligations, judging by absolute norms.",
    high: "Long-term (pragmatic): thrift, perseverance, adapting traditions to new circumstances, truth depends on context.",
    body: "Originally the \"Confucian dynamism\" dimension from the Chinese Value Survey; the 2010 version was derived from World Values Survey items. In the 2023 edition it was re-derived from Minkov's flexibility–monumentalism data. This is the dimension that differs most between the two editions.",
  },
  ivr: {
    title: "Indulgence vs Restraint (IVR)",
    low: "Restraint: gratification of desires is suppressed and regulated by strict social norms; leisure is less valued.",
    high: "Indulgence: relatively free gratification of basic human drives related to enjoying life and having fun.",
    body: "Added in 2010 from World Values Survey questions on happiness, life control and the importance of leisure.",
  },
};

export const IW_INTRO =
  "Ronald Inglehart and Christian Welzel's cultural map positions countries on two factors extracted from World Values " +
  "Survey (WVS) and European Values Study data. Each survey wave gives a new map; the editions below are the official " +
  "country scores published by the WVS. Scores are factor values centred near 0, typically between −2.5 and +2.5.";

export const IW_DOCS: Record<string, DimDoc> = {
  trad_sec: {
    title: "Traditional vs Secular-rational values",
    low: "Traditional: religion and God are very important, parent–child ties and deference to authority are stressed, divorce, abortion and euthanasia are rejected, national pride is high.",
    high: "Secular-rational: the opposite preferences; religion and traditional authority matter less and individual autonomy is emphasised.",
    body: "Built from WVS items on the importance of God, obedience and religious faith in children, justifiability of abortion, national pride and respect for authority.",
  },
  surv_self: {
    title: "Survival vs Self-expression values",
    low: "Survival: economic and physical security come first, tolerance of outsiders and minorities is low, trust is low, materialist priorities dominate.",
    high: "Self-expression: environmental protection, tolerance of foreigners and sexual minorities, gender equality and participation in decision-making are prioritised; interpersonal trust is high.",
    body: "Built from materialist/post-materialist priorities, self-reported happiness, justifiability of homosexuality, signing petitions and interpersonal trust. Tends to rise with economic development.",
  },
};

export const REGIONS_NOTE =
  "Colours group countries into world regions used by this site (not by the original authors). Hofstede's matrix also " +
  "contains a few regional aggregates and sub-national splits (e.g. \"Arab countries\", \"Belgium French\"), listed under \"Other\".";
