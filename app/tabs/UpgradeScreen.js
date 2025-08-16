// app/tabs/UpgradeScreen.js
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import Purchases from "react-native-purchases";

const ENTITLEMENT_ID = "business";
const OFFERING_ID = "default";

export default function UpgradeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [rcAvailable, setRcAvailable] = useState(true);
  const [canPay, setCanPay] = useState(false);
  const configuredOnce = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const hasRC =
          Purchases &&
          typeof Purchases.getCustomerInfo === "function" &&
          typeof Purchases.getOfferings === "function" &&
          typeof Purchases.configure === "function";
        if (!hasRC) {
          setRcAvailable(false);
          return;
        }

        if (!configuredOnce.current) {
          await Purchases.configure({
            apiKey: Platform.select({
              ios: "appl_JiUsWQRyNraQSTVYPnWAlgIrIpK",
              android: "goog_ODDOXcbpQuRRPxVIkCcasSHNRpu",
            }),
          });
          configuredOnce.current = true;
          try {
            if (Purchases?.LOG_LEVEL && typeof Purchases.setLogLevel === "function") {
              Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
            }
          } catch {}
        }

        // IMPORTANT: check if device/account can purchase before we show the button.
        try {
          const result = await Purchases.canMakePayments({
            // Android requires a billing feature list; iOS ignores this.
            features: Platform.OS === "android" ? ["BILLING_FEATURE_IN_APP_ITEMS_ON_VR"] : [],
          });
          if (mounted) setCanPay(!!result);
        } catch {
          if (mounted) setCanPay(false);
        }

        const info = await Purchases.getCustomerInfo();
        if (mounted) setIsPro(Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]));

        const offs = await Purchases.getOfferings();
        if (mounted) setOfferings(offs);
      } catch (e) {
        console.warn("RevenueCat init error:", e);
        if (mounted) {
          Alert.alert(
            "Store Unavailable",
            "We couldn’t connect to the App Store right now. Please try again later."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const businessPackage = useMemo(() => {
    if (!offerings) return null;
    const offering =
      offerings.current ??
      (offerings.all && offerings.all[OFFERING_ID]) ??
      null;
    const pkgs = Array.isArray(offering?.availablePackages)
      ? offering.availablePackages
      : [];
    if (!pkgs.length) return null;

    const monthly =
      pkgs.find((p) => p?.packageType === "MONTHLY") ||
      pkgs.find((p) => (p?.identifier || "").toLowerCase().includes("monthly"));

    const chosen = monthly || pkgs[0] || null;

    // Final sanity: make sure this looks like a real RC package
    if (!chosen?.identifier || !chosen?.product && !chosen?.storeProduct) return null;

    return chosen;
  }, [offerings]);

  const handlePurchase = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      // Hard guards to avoid native crashes
      if (!rcAvailable) {
        Alert.alert("Unavailable", "In-app purchases aren’t available in this build.");
        return;
      }
      if (!canPay) {
        Alert.alert(
          "Purchases Disabled",
          "This device/account can’t make payments. Check App Store / Play Store login or restrictions."
        );
        return;
      }
      if (!businessPackage) {
        Alert.alert(
          "Unavailable",
          "The Business plan isn’t available right now. Please try again later."
        );
        return;
      }

      // Extra safe: ensure offerings are still present
      if (!offerings?.current && !offerings?.all) {
        Alert.alert("Store Unavailable", "Offerings not loaded. Try again in a moment.");
        return;
      }

      const result = await Purchases.purchasePackage(businessPackage);

      const active =
        result?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

      if (active) {
        setIsPro(true);
        Alert.alert("Success", "Thanks for upgrading to NavMiles Business!");
      } else {
        Alert.alert(
          "Pending",
          "Your purchase is pending. You’ll be upgraded once it completes."
        );
      }
    } catch (err) {
      // The SDK throws on cancel & other errors — handle gracefully.
      const cancelled =
        err?.userCancelled ||
        err?.code === Purchases?.PurchasesErrorCode?.PurchaseCancelledError;
      if (!cancelled) {
        Alert.alert("Purchase Failed", err?.message || "Something went wrong.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const info = await Purchases.restorePurchases();
      const active = info?.entitlements?.active?.[ENTITLEMENT_ID];
      if (active) {
        setIsPro(true);
        Alert.alert("Restored!", "Your Business plan has been restored.");
      } else {
        Alert.alert(
          "No Purchases Found",
          "We didn’t find previous purchases on this Apple/Google account."
        );
      }
    } catch (err) {
      const cancelled =
        err?.userCancelled ||
        err?.code === Purchases?.PurchasesErrorCode?.PurchaseCancelledError;
      if (!cancelled) {
        Alert.alert("Restore Failed", err?.message || "Could not restore purchase.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const blue = "#3291f7";
  const bannerBlue = "#192d49";
  const yellow = "#ffcb49";
  const text = isDark ? "#b8c9e9" : "#0c2957";
  const tableBG = isDark ? "#122944" : "#f7f9fc";
  const borderColor = isDark ? "#b8c9e9" : "#1976d2";
  const red = "#ff4444";

  const rows = [
    { label: "One-Tap Gas Finder", personal: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    { label: "Low Fuel Alerts", personal: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    {
      label: "Trip Logging",
      personal: (
        <Text style={{ color: blue, fontWeight: "bold", textAlign: "center" }}>
          ✔️{"\n"}
          <Text style={{ color: blue, fontWeight: "bold", fontSize: 16 }}>(15 days)</Text>
        </Text>
      ),
      business: (
        <Text style={{ color: blue, fontWeight: "bold", textAlign: "center" }}>
          ✔️{"\n"}
          <Text style={{ color: blue, fontWeight: "bold", fontSize: 16 }}>(unlimited)</Text>
        </Text>
      ),
    },
    { label: "Export CSV/PDF", personal: <Text style={{ color: red, fontWeight: "bold" }}>✘</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    { label: "IRS Tax Deduction", personal: <Text style={{ color: red, fontWeight: "bold" }}>✘</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    { label: "Trip Type Label (Business)", personal: <Text style={{ color: red, fontWeight: "bold" }}>✘</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    { label: "Priority Support", personal: <Text style={{ color: red, fontWeight: "bold" }}>✘</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>✔️</Text> },
    { label: "Vehicle Slots", personal: <Text style={{ color: blue, fontWeight: "bold" }}>1</Text>, business: <Text style={{ color: blue, fontWeight: "bold" }}>3</Text> },
  ];

  if (!rcAvailable) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#08213a" : "#fff" }]}>
        <Text style={{ color: text, textAlign: "center", paddingHorizontal: 24 }}>
          In-app purchases aren’t available in this build. Please install a TestFlight or App Store build that includes RevenueCat.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#08213a" : "#fff" }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: text }}>Loading store…</Text>
      </View>
    );
  }

  const offeringHasPackages =
    !!businessPackage ||
    !!(offerings?.current?.availablePackages?.length) ||
    !!(offerings?.all && offerings.all[OFFERING_ID]?.availablePackages?.length);

  const upgradeDisabled = processing || !businessPackage || !canPay;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: isDark ? "#08213a" : "#fff" },
      ]}
    >
      <View style={{ height: 36 }} />
      <Text style={[styles.title, { color: blue }]}>
        {isPro ? "You're on Business 🎉" : "Compare Plans"}
      </Text>

      {!isPro && (
        <>
          <View style={[styles.banner, { backgroundColor: bannerBlue }]}>
            <Text style={[styles.bannerText, { color: yellow }]}>
              Unlock every feature — export, tax logs, and manage multiple vehicles with
            </Text>
            <Text style={[styles.bannerText, { color: blue, fontWeight: "bold", marginTop: 4 }]}>
              NavMiles Business!
            </Text>
          </View>

          {!offeringHasPackages ? (
            <Text style={{ color: text, textAlign: "center", marginBottom: 16, paddingHorizontal: 16 }}>
              Purchases are currently unavailable (no products found).  
              Double-check your products/offerings in RevenueCat & App Store Connect.
            </Text>
          ) : (
            <>
              <View style={[styles.table, { borderColor: borderColor, backgroundColor: tableBG }]}>
                <View style={[styles.row, { borderBottomColor: borderColor }]}>
                  <Text style={styles.headerCell}></Text>
                  <Text style={[styles.headerCell, { color: blue }]}>Personal</Text>
                  <Text style={[styles.headerCell, { color: blue }]}>Business</Text>
                </View>
                {rows.map((r, i) => (
                  <View
                    key={r.label}
                    style={[
                      styles.row,
                      { borderBottomColor: borderColor },
                      i === rows.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.cell, { color: blue }]}>{r.label}</Text>
                    <Text style={styles.cell}>{r.personal}</Text>
                    <Text style={styles.cell}>{r.business}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.upgradeBtn,
                  { backgroundColor: upgradeDisabled ? "#93bdf8" : blue },
                ]}
                disabled={upgradeDisabled}
                onPress={handlePurchase}
              >
                <Text style={styles.upgradeText}>
                  {processing
                    ? "Processing..."
                    : !canPay
                    ? "Purchases Disabled"
                    : businessPackage
                    ? "Upgrade to Business"
                    : "Not Available"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.upgradeBtn, { backgroundColor: "#bbb", marginTop: 0, marginBottom: 10 }]}
                onPress={handleRestore}
                disabled={processing}
              >
                <Text style={[styles.upgradeText, { color: "#233", fontSize: 17 }]}>
                  {processing ? "Restoring..." : "Restore Purchase"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {isPro && (
        <Text style={{ color: text, fontSize: 16, textAlign: "center" }}>
          Your Business features are unlocked. Enjoy unlimited logs, exports, and more!
        </Text>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 18, textAlign: "center" },
  banner: { width: "100%", borderRadius: 18, marginBottom: 24, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center" },
  bannerText: { fontWeight: "bold", fontSize: 17, textAlign: "center", lineHeight: 24 },
  table: { width: "100%", borderWidth: 1.2, borderRadius: 14, overflow: "hidden", marginBottom: 28 },
  row: { flexDirection: "row", borderBottomWidth: 1 },
  headerCell: { flex: 1, fontWeight: "bold", textAlign: "center", backgroundColor: "transparent", padding: 12, fontSize: 17, letterSpacing: 1 },
  cell: { flex: 1, textAlign: "center", padding: 12, fontSize: 16, fontWeight: "bold", backgroundColor: "transparent" },
  upgradeBtn: { borderRadius: 9, paddingHorizontal: 40, paddingVertical: 17, alignSelf: "center", marginTop: 8, marginBottom: 40 },
  upgradeText: { color: "#fff", fontWeight: "bold", fontSize: 21, letterSpacing: 1, textAlign: "center" },
});
