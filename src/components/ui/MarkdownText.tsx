import { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { colors } from '@/lib/theme';

type Props = {
  value: string;
  /** Cor do texto base (default `text`). Use `textInverse` em fundo claro. */
  textColor?: string;
  /** Tamanho do texto base (default 14). */
  fontSize?: number;
  style?: ViewStyle;
};

/**
 * Renderiza markdown sem FlatList interno (usa o hook + View) — seguro pra
 * usar dentro de outras listas/scrolls como ChatBubble.
 *
 * Tema dark sincronizado com o app: accent neon em links/code-inline,
 * surface-muted nos blocos de código e blockquote, danger nos avisos.
 */
export default function MarkdownText({
  value,
  textColor,
  fontSize = 14,
  style,
}: Props) {
  const text = textColor ?? colors.text;

  const styles = useMemo<MarkedStyles>(
    () => ({
      text: {
        color: text,
        fontSize,
        lineHeight: fontSize * 1.5,
      },
      paragraph: {
        marginVertical: 4,
        flexWrap: 'wrap',
        flexDirection: 'row',
      },
      strong: { color: text, fontWeight: '700' },
      em: { color: text, fontStyle: 'italic' },
      strikethrough: { color: text, textDecorationLine: 'line-through' },
      link: {
        color: colors.accent,
        textDecorationLine: 'underline',
      },
      h1: {
        color: text,
        fontSize: fontSize + 8,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 4,
      },
      h2: {
        color: text,
        fontSize: fontSize + 6,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 4,
      },
      h3: {
        color: text,
        fontSize: fontSize + 3,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 2,
      },
      h4: {
        color: text,
        fontSize: fontSize + 1,
        fontWeight: '600',
        marginTop: 6,
        marginBottom: 2,
      },
      h5: { color: text, fontSize, fontWeight: '600' },
      h6: { color: text, fontSize, fontWeight: '600' },
      codespan: {
        color: colors.accent,
        backgroundColor: colors.surfaceMuted,
        fontFamily: 'monospace',
        fontSize: fontSize - 1,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
      },
      code: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginVertical: 6,
      },
      blockquote: {
        backgroundColor: colors.surfaceMuted,
        borderLeftColor: colors.accent,
        borderLeftWidth: 3,
        paddingLeft: 10,
        paddingVertical: 4,
        marginVertical: 6,
      },
      list: { marginVertical: 4 },
      li: { color: text, fontSize, lineHeight: fontSize * 1.5 },
      hr: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 10,
      },
      table: {
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 6,
        marginVertical: 6,
      },
      tableRow: { borderBottomColor: colors.border, borderBottomWidth: 1 },
      tableCell: { padding: 6 },
    }),
    [text, fontSize],
  );

  const nodes = useMarkdown(value, {
    colorScheme: 'dark',
    styles,
  });

  return <View style={style}>{nodes}</View>;
}
