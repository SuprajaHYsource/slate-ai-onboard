import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import logoLight from "@/assets/slate-ai-logo-light.png";
import logoDark from "@/assets/slate-ai-logo-dark.png";

interface LogoProps {
  className?: string;
  onClick?: () => void;
}

export const Logo = ({ className = "h-8", onClick }: LogoProps) => {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <img src={logoLight} alt="SLATE AI" className={className} />;
  }

  const currentTheme = theme === "system" ? systemTheme : theme;
  const logoSrc = currentTheme === "dark" ? logoDark : logoLight;

  return <img src={logoSrc} alt="SLATE AI" className={className} onClick={onClick} />;
};
