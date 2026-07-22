import { Linking, Text } from 'react-native';
import Checkbox from '@/components/ui/Checkbox';
import { useLegalDocs } from '@/hooks/useLegalDocs';
import type { LegalDocType } from '@/types/legal';

type Props = {
  accepted: boolean;
  onChange: (next: boolean) => void;
};

/**
 * Bloco de aceite dos termos no cadastro (spec #4). Checkbox + texto com os termos
 * linkados às URLs públicas do hotsite (lidas de legal_documents). O aceite cobre
 * Termos de Uso + Termos de Contrato; a Privacidade aparece como link de divulgação.
 */
export default function TermsAcceptance({ accepted, onChange }: Props) {
  const { byType } = useLegalDocs();

  const open = (doc_type: LegalDocType) => {
    const url = byType(doc_type)?.url;
    if (url) void Linking.openURL(url);
  };

  const Link = ({
    doc_type,
    label,
  }: {
    doc_type: LegalDocType;
    label: string;
  }) => (
    <Text
      className="text-violet-soft font-semibold"
      onPress={() => open(doc_type)}
    >
      {label}
    </Text>
  );

  return (
    <Checkbox checked={accepted} onChange={onChange}>
      <Text className="text-text-dim text-[12px] leading-relaxed">
        Li e aceito os <Link doc_type="termos_uso" label="Termos de Uso" /> e o{' '}
        <Link doc_type="termos_contrato" label="Termos de Contrato" />. Veja também
        nossa <Link doc_type="privacidade" label="Política de Privacidade" />.
      </Text>
    </Checkbox>
  );
}
