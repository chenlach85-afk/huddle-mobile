import colors from "@/constants/colors";

export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}

export type ColorTokens = typeof colors.dark & { radius: number };
