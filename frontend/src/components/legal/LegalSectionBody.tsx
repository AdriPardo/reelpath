type LegalSectionDef = {
  id: string;
  titleKey: string;
  paragraphKeys?: string[];
  listKeys?: string[];
};

export function LegalSectionBody({
  sections,
  t,
}: {
  sections: LegalSectionDef[];
  t: (key: string) => string;
}) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id}>
          <h2>{t(section.titleKey)}</h2>
          {section.paragraphKeys?.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
          {section.listKeys && section.listKeys.length > 0 && (
            <ul>
              {section.listKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

export const PRIVACY_SECTIONS: LegalSectionDef[] = [
  { id: 's1', titleKey: 's1Title', paragraphKeys: ['s1P1'], listKeys: ['s1Li1', 's1Li2', 's1Li3'] },
  { id: 's2', titleKey: 's2Title', paragraphKeys: ['s2P1', 's2P2'] },
  {
    id: 's3',
    titleKey: 's3Title',
    listKeys: ['s3Li1', 's3Li2', 's3Li3', 's3Li4', 's3Li5'],
    paragraphKeys: ['s3P1'],
  },
  { id: 's4', titleKey: 's4Title', paragraphKeys: ['s4Intro', 's4P1'], listKeys: ['s4Li1', 's4Li2', 's4Li3', 's4Li4'] },
  {
    id: 's5',
    titleKey: 's5Title',
    paragraphKeys: ['s5P1'],
    listKeys: ['s5Li1', 's5Li2', 's5Li3'],
  },
  { id: 's6', titleKey: 's6Title', paragraphKeys: ['s6Intro'], listKeys: ['s6Li1', 's6Li2', 's6Li3'] },
  {
    id: 's7',
    titleKey: 's7Title',
    listKeys: ['s7Li1', 's7Li2', 's7Li3'],
  },
  { id: 's8', titleKey: 's8Title', paragraphKeys: ['s8P1'] },
  { id: 's9', titleKey: 's9Title', paragraphKeys: ['s9P1'] },
  { id: 's10', titleKey: 's10Title', paragraphKeys: ['s10P1'] },
  { id: 's11', titleKey: 's11Title', paragraphKeys: ['s11P1'] },
  { id: 's12', titleKey: 's12Title', paragraphKeys: ['s12P1'] },
  { id: 's13', titleKey: 's13Title', paragraphKeys: ['s13P1'] },
];

export const TERMS_SECTIONS: LegalSectionDef[] = [
  { id: 's1', titleKey: 's1Title', paragraphKeys: ['s1P1'] },
  { id: 's2', titleKey: 's2Title', paragraphKeys: ['s2P1'], listKeys: ['s2Li1', 's2Li2', 's2Li3'] },
  { id: 's3', titleKey: 's3Title', paragraphKeys: ['s3Intro'], listKeys: ['s3Li1', 's3Li2', 's3Li3', 's3Li4'] },
  { id: 's4', titleKey: 's4Title', paragraphKeys: ['s4Intro'], listKeys: ['s4Li1', 's4Li2', 's4Li3', 's4Li4'] },
  { id: 's5', titleKey: 's5Title', paragraphKeys: ['s5Intro'], listKeys: ['s5Li1', 's5Li2', 's5Li3', 's5Li4'] },
  { id: 's6', titleKey: 's6Title', paragraphKeys: ['s6P1', 's6P2'] },
  { id: 's7', titleKey: 's7Title', paragraphKeys: ['s7P1'] },
  { id: 's8', titleKey: 's8Title', paragraphKeys: ['s8P1'], listKeys: ['s8Li1', 's8Li2'] },
  { id: 's9', titleKey: 's9Title', paragraphKeys: ['s9P1'] },
  { id: 's10', titleKey: 's10Title', paragraphKeys: ['s10P1', 's10P2'] },
  { id: 's11', titleKey: 's11Title', paragraphKeys: ['s11P1'] },
  { id: 's12', titleKey: 's12Title', paragraphKeys: ['s12P1'] },
  { id: 's13', titleKey: 's13Title', paragraphKeys: ['s13P1'] },
  { id: 's14', titleKey: 's14Title', paragraphKeys: ['s14P1'] },
];
