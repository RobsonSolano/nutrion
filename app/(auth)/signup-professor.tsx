import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  GraduationCap,
  ArrowLeft,
  IdCard,
  FileText,
} from 'lucide-react-native';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { signUpWithPassword } from '@/services/auth';
import { promoteToProfessor } from '@/services/coach';
import { colors } from '@/lib/theme';
import { Button, Input, Logo, Screen } from '@/components/ui';
import { captureError } from '@/lib/sentry';

const MAX_BIO = 300;
const MAX_CREF = 30;

export default function SignupProfessorScreen() {
  const router = useRouter();
  const kbHeight = useKeyboardHeight();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [cref, setCref] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    setLoading(true);
    try {
      // 1) Cria o auth.users + profile (via trigger handle_new_user).
      await signUpWithPassword({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      // 2) Promove pra role=professor + cria row em coaches.
      await promoteToProfessor({
        bio: bio.trim() || null,
        cref: cref.trim() || null,
      });
      // 3) Redireciona pra área do professor.
      router.replace('/(coach)' as Href);
    } catch (err) {
      captureError(err, { feature: 'signup_professor' });
      Alert.alert(
        'Não consegui criar a conta',
        err instanceof Error ? err.message : 'Verifica os dados e tenta de novo.',
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    email.length > 3 &&
    password.length >= 6 &&
    fullName.trim().length >= 2 &&
    cref.trim().length >= 4 &&
    cref.length <= MAX_CREF &&
    bio.length <= MAX_BIO;

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 32 + (Platform.OS === 'android' ? kbHeight : 0),
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="self-start h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70 mb-4"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>

          <View className="items-center mb-6">
            <View className="h-14 w-14 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center mb-3">
              <GraduationCap size={26} color={colors.violetSoft} />
            </View>
            <Logo size="md" />
            <Text className="text-text-dim text-[11px] tracking-[3px] uppercase mt-2">
              Conta de Professor
            </Text>
            <Text className="text-text-muted text-xs text-center mt-3 leading-relaxed px-2">
              Cadastre alunos, monte treinos com a IA e acompanhe o dia-a-dia
              deles.
            </Text>
          </View>

          <View className="gap-3">
            <Input
              value={fullName}
              onChangeText={setFullName}
              placeholder="Seu nome"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              leftIcon={<UserIcon size={18} color={colors.textMuted} />}
            />

            <Input
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              leftIcon={<Mail size={18} color={colors.textMuted} />}
            />

            <Input
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha (mín. 6)"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="next"
              leftIcon={<Lock size={18} color={colors.textMuted} />}
              rightAccessory={
                showPassword ? (
                  <EyeOff size={18} color={colors.textDim} />
                ) : (
                  <Eye size={18} color={colors.textDim} />
                )
              }
              onRightAccessoryPress={() => setShowPassword((v) => !v)}
            />

            <Input
              value={cref}
              onChangeText={setCref}
              placeholder="CREF (Ed. Física) ou CRN (Nutrição)"
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={<IdCard size={18} color={colors.textMuted} />}
            />
            <Text className="text-text-muted text-[11px] px-1">
              Obrigatório — credencial profissional. Aparece no seu perfil
              pra você e seus alunos identificarem.
            </Text>

            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Bio profissional (opcional)"
              multiline
              numberOfLines={3}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              leftIcon={<FileText size={18} color={colors.textMuted} />}
            />

            <Text className="text-text-muted text-[11px] px-1">
              {bio.length}/{MAX_BIO}
            </Text>

            <View className="mt-2">
              <Button
                label="Criar conta de professor"
                onPress={handleSubmit}
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!canSubmit}
              />
            </View>
          </View>

          <Text className="text-text-muted text-[11px] text-center mt-8 leading-relaxed px-2">
            Ao criar a conta de professor, você aceita o uso responsável do app
            no acompanhamento dos seus alunos. As recomendações da IA são
            informativas — decisões de saúde devem ser validadas com
            profissionais.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
