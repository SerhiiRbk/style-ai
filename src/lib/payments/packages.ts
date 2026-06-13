import {
  CREDIT_PACKAGES,
  type CreditPackage,
} from "@/lib/credit-costs";

export function packageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Total credits a package grants (base + bonus). */
export function packageCredits(pkg: CreditPackage): number {
  return pkg.credits + pkg.bonus;
}
