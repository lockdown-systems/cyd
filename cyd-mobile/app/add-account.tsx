import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { authenticateBlueskyAccount } from "@/services/bluesky-oauth";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function AddAccountScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = handle.trim().length > 0 && !submitting;

  const onAuthenticate = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await authenticateBlueskyAccount(handle);
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Add Bluesky Account",
          headerBackTitle: "Back",
          headerTintColor: palette.text,
          headerStyle: { backgroundColor: palette.background },
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={[styles.container, { backgroundColor: palette.card }]}>
          <Text style={[styles.title, { color: palette.text }]}>
            Authenticate with Bluesky
          </Text>
          <Text style={[styles.description, { color: palette.icon }]}>
            Enter your Bluesky handle to allow the Cyd app to manage your
            account. Everything happens locally on your phone, and Cyd does not
            collect any of your Bluesky data.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.icon }]}>
              Bluesky handle
            </Text>
            <TextInput
              value={handle}
              onChangeText={(text) => {
                setHandle(text);
                setError(null);
              }}
              placeholder="username.bsky.social"
              placeholderTextColor={palette.icon + "88"}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: palette.text,
                  borderColor: palette.icon + "33",
                  backgroundColor: palette.background,
                },
              ]}
              returnKeyType="go"
              editable={!submitting}
              onSubmitEditing={onAuthenticate}
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.tint }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={onAuthenticate}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: palette.button.background,
                opacity: pressed || !canSubmit ? 0.7 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={palette.button.text} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: palette.button.text },
                ]}
              >
                Authenticate
              </Text>
            )}
          </Pressable>

          <Text style={[styles.footerHint, { color: palette.icon }]}>
            After signing in, you will return here and your account will be
            added.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footerHint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
