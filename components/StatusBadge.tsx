import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Status = "active" | "invited" | "pending_invitation" | "declined" | "inactive" | "attending" | "not_attending" | "maybe" | "no_response" | "pending" | "in_progress" | "done" | "low" | "medium" | "high";

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  invited: { label: "Invited", color: "#60A5FA", bg: "rgba(96,165,250,0.15)" },
  pending_invitation: { label: "Pending", color: "#F5B700", bg: "rgba(245,183,0,0.15)" },
  declined: { label: "Declined", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  inactive: { label: "Inactive", color: "#73839B", bg: "rgba(115,131,155,0.15)" },
  attending: { label: "Going", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  not_attending: { label: "Can't Go", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  maybe: { label: "Maybe", color: "#F5B700", bg: "rgba(245,183,0,0.15)" },
  no_response: { label: "No Reply", color: "#73839B", bg: "rgba(115,131,155,0.15)" },
  pending: { label: "To Do", color: "#F5B700", bg: "rgba(245,183,0,0.15)" },
  in_progress: { label: "In Progress", color: "#60A5FA", bg: "rgba(96,165,250,0.15)" },
  done: { label: "Done", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  low: { label: "Low", color: "#73839B", bg: "rgba(115,131,155,0.15)" },
  medium: { label: "Medium", color: "#F5B700", bg: "rgba(245,183,0,0.15)" },
  high: { label: "High", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
};

interface Props {
  status: Status;
  small?: boolean;
}

export function StatusBadge({ status, small }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: config.color }, small && styles.smallText]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 12, fontWeight: "600" },
  small: { paddingHorizontal: 7, paddingVertical: 2 },
  smallText: { fontSize: 10 },
});
