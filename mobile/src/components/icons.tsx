import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { colors } from "../theme/tokens";

interface IconProps {
  color?: string;
  size?: number;
}

const common = { fill: "none", strokeWidth: 2.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconHome({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 11.5 12 4l9 7.5" stroke={color} {...common} />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1v-9" stroke={color} {...common} />
    </Svg>
  );
}

export function IconWallet({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="6" width="18" height="13" rx="2.5" stroke={color} {...common} />
      <Path d="M3 10h18" stroke={color} {...common} />
      <Circle cx="16.5" cy="14" r="1.2" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconShield({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.5 19 6v6c0 4.2-3 7-7 8.5-4-1.5-7-4.3-7-8.5V6z" stroke={color} {...common} />
      <Path d="M9 12l2 2 4-4.5" stroke={color} {...common} />
    </Svg>
  );
}

export function IconKey({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="8" cy="15" r="4" stroke={color} {...common} />
      <Path d="M11 12l8-8" stroke={color} {...common} />
      <Path d="M16 7l2.5 2.5" stroke={color} {...common} />
      <Path d="M19 4l1.5 1.5" stroke={color} {...common} />
    </Svg>
  );
}

export function IconBook({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" stroke={color} {...common} />
      <Path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" stroke={color} {...common} />
    </Svg>
  );
}

export function IconArrowUpRight({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="7" y1="17" x2="17" y2="7" stroke={color} {...common} />
      <Path d="M9 7h8v8" stroke={color} {...common} />
    </Svg>
  );
}

export function IconArrowDownLeft({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="17" y1="7" x2="7" y2="17" stroke={color} {...common} />
      <Path d="M15 17H7V9" stroke={color} {...common} />
    </Svg>
  );
}

export function IconPlus({ color = colors.text, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} {...common} />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} {...common} />
    </Svg>
  );
}

export function IconChevronRight({ color = colors.text, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" stroke={color} {...common} />
    </Svg>
  );
}

export function IconLogOut({ color = colors.text, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M16 17l5-5-5-5" stroke={color} {...common} />
      <Path d="M21 12H9" stroke={color} {...common} />
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} {...common} />
    </Svg>
  );
}
