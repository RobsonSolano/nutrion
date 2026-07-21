// Seleção de produto de assinatura no paywall (#5b). Lógica pura → testável sem RN/SDK.
// Decide QUAL product ID comprar a partir do papel do usuário, da feature que disparou o
// 402 e do tier atual. O paywall (app/paywall.tsx) então acha o package correspondente
// nas offerings do RevenueCat e chama purchasePackage.

import type { FeatureKey, Tier } from '@/types/billing';

/** Product IDs das assinaturas no Play (imutáveis; precisam bater com o console + RevenueCat). */
export type ProductId =
  | 'nutrion_comum_pro'
  | 'nutrion_prof_pro'
  | 'nutrion_prof_premium';

export type Role = 'aluno' | 'comum' | 'professor';

type Params = {
  role: Role | null | undefined;
  feature: FeatureKey | undefined;
  currentTier: Tier;
};

/**
 * Retorna o product ID que o usuário deve comprar, ou `null` quando não há compra a oferecer
 * (aluno — IA herdada do professor; ou já está no tier que cobre a feature).
 */
export function selectProductId({ role, feature, currentTier }: Params): ProductId | null {
  // Aluno não compra: acesso à IA vem do plano do professor (C4).
  if (role === 'comum') {
    // Comum só tem o tier `pro`. Free → compra; já pro → nada a oferecer.
    return currentTier === 'free' ? 'nutrion_comum_pro' : null;
  }

  if (role === 'professor') {
    if (currentTier === 'premium') return null; // já é o topo
    // Estourou o limite de alunos já sendo pro → sobe pra premium (ilimitado).
    if (feature === 'student_limit' && currentTier === 'pro') {
      return 'nutrion_prof_premium';
    }
    // Free (IA de coach ou limite) → pro cobre (IA + 20 alunos).
    if (currentTier === 'free') return 'nutrion_prof_pro';
    // Pro pedindo feature de IA que o pro já cobre → nada a fazer (defensivo).
    return null;
  }

  return null;
}

// Estrutura mínima do que precisamos das offerings do RevenueCat (subconjunto de
// PurchasesOfferings) — mantém o helper puro/testável sem depender do SDK.
type MinimalPackage = { product: { identifier: string } };
type MinimalOfferings<P extends MinimalPackage> = {
  all: Record<string, { availablePackages: P[] }>;
};

/**
 * Acha o package correspondente a um product ID nas offerings. No Google, o identifier do
 * produto vem como `productId:basePlanId` (ex: `nutrion_comum_pro:mensal`), então casamos por
 * igualdade OU prefixo `productId:`. Retorna null se não achar (defensivo).
 */
export function findPackage<P extends MinimalPackage>(
  offerings: MinimalOfferings<P> | null | undefined,
  productId: string,
): P | null {
  if (!offerings) return null;
  for (const offering of Object.values(offerings.all)) {
    for (const pkg of offering.availablePackages) {
      const id = pkg.product.identifier;
      if (id === productId || id.startsWith(`${productId}:`)) return pkg;
    }
  }
  return null;
}
