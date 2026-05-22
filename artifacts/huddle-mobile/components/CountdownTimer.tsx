import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function pad(n: number) { return String(n).padStart(2, "0"); }

interface Props {
  targetDate: string;
}

export function CountdownTimer({ targetDate }: Props) {
  const colors = useColors();
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const update = () => setDiff(Math.max(0, new Date(targetDate).getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  const parts = [
    { value: days, label: "D" },
    { value: hours, label: "H" },
    { value: mins, label: "M" },
    { value: secs, label: "S" },
  ];

  return (
    <View style={styles.row}>
      {parts.map((p, i) => (
        <React.Fragment key={p.label}>
          <View style={styles.unit}>
            <Text style={[styles.num, { color: colors.primary }]}>{pad(p.value)}</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{p.label}</Text>
          </View>
          {i < 3 && <Text style={[styles.colon, { color: colors.primary }]}>:</Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  unit: { alignItems: "center" },
  num: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  label: { fontSize: 10, fontWeight: "600", marginTop: -2 },
  colon: { fontSize: 28, fontWeight: "700", marginBottom: 10 },
});
