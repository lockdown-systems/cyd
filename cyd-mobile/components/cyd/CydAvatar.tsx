import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import CydPlain from "@/assets/images/cyd-plain.svg";
import CydPlainBlink from "@/assets/images/cyd-plain-blink.svg";
import CydPlainLook from "@/assets/images/cyd-plain-look.svg";
import CydAkimbo from "@/assets/images/cyd-akimbo.svg";
import CydAkimboBlink from "@/assets/images/cyd-akimbo-blink.svg";
import CydAkimboLook from "@/assets/images/cyd-akimbo-look.svg";
import CydWing from "@/assets/images/cyd-wing.svg";
import CydWingBlink from "@/assets/images/cyd-wing-blink.svg";
import CydWingLook from "@/assets/images/cyd-wing-look.svg";
import CydPoint from "@/assets/images/cyd-point.svg";
import CydPointBlink from "@/assets/images/cyd-point-blink.svg";
import CydPointLook from "@/assets/images/cyd-point-look.svg";
import CydShrug from "@/assets/images/cyd-shrug.svg";
import CydShrugBlink from "@/assets/images/cyd-shrug-blink.svg";
import CydShrugLook from "@/assets/images/cyd-shrug-look.svg";

const STANCES = ["plain", "akimbo", "wing", "point", "shrug"] as const;
type Stance = (typeof STANCES)[number];
type Variant = "default" | "blink" | "look";

type AvatarMap = Record<Stance, Record<Variant, ComponentType<SvgProps>>>;

const AVATARS: AvatarMap = {
  plain: {
    default: CydPlain,
    blink: CydPlainBlink,
    look: CydPlainLook,
  },
  akimbo: {
    default: CydAkimbo,
    blink: CydAkimboBlink,
    look: CydAkimboLook,
  },
  wing: {
    default: CydWing,
    blink: CydWingBlink,
    look: CydWingLook,
  },
  point: {
    default: CydPoint,
    blink: CydPointBlink,
    look: CydPointLook,
  },
  shrug: {
    default: CydShrug,
    blink: CydShrugBlink,
    look: CydShrugLook,
  },
};

const randomStance = (): Stance =>
  STANCES[Math.floor(Math.random() * STANCES.length)];

const LOOP_MIN = 5000;
const LOOP_VARIANCE = 3000;

const getDelay = () => LOOP_MIN + Math.random() * LOOP_VARIANCE;

type Props = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

function CydAvatarComponent({ height = 140, style }: Props) {
  const [stance, setStance] = useState<Stance>("plain");
  const [variant, setVariant] = useState<Variant>("default");
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  const destroyedRef = useRef(false);

  useEffect(() => {
    const schedule = (fn: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        timeouts.current.delete(timeout);
        if (!destroyedRef.current) {
          fn();
        }
      }, delay);
      timeouts.current.add(timeout);
    };

    const startStanceLoop = () => {
      schedule(() => {
        setStance(randomStance());
        startStanceLoop();
      }, getDelay());
    };

    const startBlinkLoop = () => {
      schedule(() => {
        const nextVariant: Variant = Math.random() < 0.5 ? "blink" : "look";
        setVariant(nextVariant);
        const resetTimeout = setTimeout(() => {
          timeouts.current.delete(resetTimeout);
          if (!destroyedRef.current) {
            setVariant("default");
          }
        }, 450);
        timeouts.current.add(resetTimeout);
        startBlinkLoop();
      }, getDelay());
    };

    startStanceLoop();
    startBlinkLoop();

    const currentTimeouts = timeouts.current;
    return () => {
      destroyedRef.current = true;
      currentTimeouts.forEach((timeout) => clearTimeout(timeout));
      currentTimeouts.clear();
    };
  }, []);

  const Avatar = useMemo(() => AVATARS[stance][variant], [stance, variant]);

  return (
    <View style={[styles.avatarContainer, style]}>
      <Avatar
        height={height}
        width={height}
        preserveAspectRatio="xMidYMid meet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export const CydAvatar = memo(CydAvatarComponent);
export default CydAvatar;
