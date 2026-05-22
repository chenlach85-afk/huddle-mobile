import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Status = "active" | "invited" | "pending_invitation" | "declined" | "inactive" | "attending" | "not_attending" | "maybe" | "no_response" | "pending" | "in_progress" | "done" | "low" | "medium" | "high";

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#2ecc71", bg: "rgba(46,204,113,0.15)" },
  invited: { label: "Invited", color: "#4a90e2", bg: "rgba(74,144,226,0.15)" },
  pending_invitation: { label: "Pending", color: "#f7b538", bg: "rgba(247,181,56,0.15)" },
  declined: { label: "Declined", color: "#ef3b3b", bg: "rgba(239,59,59,0.15)" },
  inactive: { label: "Inactive", color: "#7a8399", bg: "rgba(122,131,153,0.15)" },
  attending: { label: "Going", color: "#2ecc71", bg: "rgba(46,204,113,0.15)" },
  not_attending: { label: "Can't Go", color: "#ef3b3b", bg: "rgba(239,59,59,0.15)" },
  maybe: { label: "Maybe", color: "#f7b538", bg: "rgba(247,181,56,0.15)" },
  no_response: { label: "No Reply", color: "#7a8399", bg: "rgba(122,131,153,0.15)" },
  pending: { label: "To Do", color: "#f7b538", bg: "rgba(247,181,56,0.15)" },
  in_progress: { label: "In Progress", color: "#4a90e2", bg: "rgba(74,144,226,0.15)" },
  done: { label: "Done", color: "#2ecc71", bg: "rgba(46,204,113,0.15)" },
  low: { label: "Low", color: "#7a8399", bg: "rgba(122,131,153,0.15)" },
  medium: { label: "Medium", color: "#f7b538", bg: "rgba(247,181,56,0.15)" },
  high: { label: "High", color: "#ef3b3b", bg: "rgba(239,59,59,0.15)" },
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
