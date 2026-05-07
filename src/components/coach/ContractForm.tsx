import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Save } from 'lucide-react-native';
import { Button, Card, Input, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import { formatBRL, parseBRL } from '@/lib/money';
import type {
  ContractInput,
  ContractType,
  StudentContract,
} from '@/types/database';

const TYPES: { value: ContractType; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'treino', label: 'Treino' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'parceria', label: 'Parceria' },
];

const TYPE_HINTS: Record<ContractType, string> = {
  mensal: 'Cobrança mensal recorrente.',
  treino: 'Valor por treino executado.',
  semanal: 'Cobrança semanal recorrente.',
  parceria: 'Sem cobrança — colaboração / cortesia.',
};

type Mode = 'create' | 'edit';

type Props = {
  studentId: string;
  initial?: StudentContract;
  mode: Mode;
  loading?: boolean;
  onSubmit: (payload: ContractInput) => void | Promise<void>;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export default function ContractForm({
  studentId,
  initial,
  mode,
  loading,
  onSubmit,
}: Props) {
  const [type, setType] = useState<ContractType>(initial?.type ?? 'mensal');
  const [startDate, setStartDate] = useState<string>(
    initial?.start_date ?? isoToday(),
  );
  const [endDate, setEndDate] = useState<string>(initial?.end_date ?? '');
  const [hasEndDate, setHasEndDate] = useState<boolean>(!!initial?.end_date);
  const [valueCents, setValueCents] = useState<number>(
    initial?.value_cents ?? 0,
  );
  const [paymentDay, setPaymentDay] = useState<string>(
    initial?.payment_day != null ? String(initial.payment_day) : '',
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');

  const isParceria = type === 'parceria';

  const parsedPaymentDay = useMemo(() => {
    if (!paymentDay.trim()) return null;
    const n = parseInt(paymentDay, 10);
    return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
  }, [paymentDay]);

  const canSubmit =
    isValidDate(startDate) &&
    (!hasEndDate || (isValidDate(endDate) && endDate >= startDate)) &&
    (isParceria || valueCents > 0) &&
    (paymentDay.trim() === '' || parsedPaymentDay !== null);

  function handleSubmit() {
    if (!canSubmit) return;
    void onSubmit({
      student_id: studentId,
      type,
      start_date: startDate,
      end_date: hasEndDate && endDate ? endDate : null,
      value_cents: isParceria ? null : valueCents,
      payment_day: isParceria ? null : parsedPaymentDay,
      notes: notes.trim() || null,
    });
  }

  return (
    <View className="gap-3">
      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Tipo de contrato
        </Text>
        <SegmentedControl
          options={TYPES}
          value={type}
          onChange={(v) => setType(v as ContractType)}
        />
        <Text className="text-text-muted text-[11px] mt-2 leading-relaxed">
          {TYPE_HINTS[type]}
        </Text>
      </Card>

      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Vigência
        </Text>
        <View className="gap-2">
          <Input
            label="Início (AAAA-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-05-07"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="flex-row items-center gap-2 mt-1">
            <Pressable
              onPress={() => setHasEndDate((v) => !v)}
              className={`flex-row items-center gap-2 rounded-full border px-3 py-1.5 ${
                hasEndDate
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-border bg-surface-muted'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  hasEndDate ? 'text-accent' : 'text-text-dim'
                }`}
              >
                {hasEndDate ? 'Tem prazo' : 'Sem prazo definido'}
              </Text>
            </Pressable>
          </View>

          {hasEndDate && (
            <Input
              label="Fim (AAAA-MM-DD)"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-12-31"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </View>
      </Card>

      {!isParceria && (
        <Card padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Valor e pagamento
          </Text>
          <View className="gap-2">
            <Input
              label={type === 'treino' ? 'Valor por treino (R$)' : 'Valor (R$)'}
              value={formatBRL(valueCents)}
              onChangeText={(v) => setValueCents(parseBRL(v))}
              placeholder="R$ 0,00"
              keyboardType="numeric"
            />
            <Input
              label="Dia de pagamento (1-31, opcional)"
              value={paymentDay}
              onChangeText={setPaymentDay}
              placeholder="Ex: 5"
              keyboardType="number-pad"
              maxLength={2}
            />
            {paymentDay.trim() !== '' && parsedPaymentDay === null && (
              <Text className="text-danger text-[11px]">
                Dia inválido. Use um número entre 1 e 31.
              </Text>
            )}
          </View>
        </Card>
      )}

      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Observações (opcional)
        </Text>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Notas internas (max 1000 chars)"
          multiline
          numberOfLines={3}
          maxLength={1000}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </Card>

      <Button
        label={mode === 'edit' ? 'Salvar alterações' : 'Criar contrato'}
        onPress={handleSubmit}
        disabled={!canSubmit || loading}
        loading={loading}
        icon={<Save size={16} color={colors.textInverse} />}
      />
    </View>
  );
}
