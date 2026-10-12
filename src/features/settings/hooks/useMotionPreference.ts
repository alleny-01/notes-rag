import { useEffect, useState } from "react";
import { useSettings } from "./useSettings";

export function useMotionPreference() {
  const { isReduced } = useSettings();
  const [reduced, setReduced] = useState(isReduced);
  useEffect(() => setReduced(isReduced), [isReduced]);
  return reduced;
}
