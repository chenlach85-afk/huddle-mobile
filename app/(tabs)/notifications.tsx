import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useNotifications, useMarkAllRead } from "@/lib/useApi";
import { EmptyState } from "@/components/EmptyState";

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  event: { icon: "calendar", color: "#60A5FA" },
  task: { icon: "check-square", color: "#F5B700" },
  message: { icon: "message-circle", color: "#22C55E" },
  general: { icon: "bell", color: "#18C6B4" },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: notifications, isLoading, refetch } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={() => markAllRead()} activeOpacity={0.7}>
            <Text style={[styles.markRead, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(n) => String(n.id)}
          onRefresh={refetch}
          refreshing={isLoading}
          scrollEnabled={!!(notifications?.length)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 : 100, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="bell" title="All caught up" subtitle="No notifications yet" />}
          renderItem={({ item: notif }) => {
            const config = TYPE_ICONS[notif.type] ?? TYPE_ICONS.general;
            return (
              <View style={[
                styles.card,
                { backgroundColor: colors.card },
                !notif.read && { borderLeftWidth: 3, borderLeftColor: colors.primary },
              ]}>
                <View style={[styles.iconBox, { backgroundColor: `${config.color}22` }]}>
                  <Feather name={config.icon as any} size={18} color={config.color} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.nTitle, { color: colors.foreground }]}>{notif.title}</Text>
                  <Text style={[styles.nBody, { color: colors.mutedForeground }]} numberOfLines={2}>{notif.body}</Text>
                  <Text style={[styles.nTime, { color: colors.mutedForeground }]}>
                    {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                  </Text>
                </View>
                {!notif.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  markRead: { fontSize: 14, fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 14, padding: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  body: { flex: 1, gap: 3 },
  nTitle: { fontSize: 15, fontWeight: "600" },
  nBody: { fontSize: 13, lineHeight: 18 },
  nTime: { fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
