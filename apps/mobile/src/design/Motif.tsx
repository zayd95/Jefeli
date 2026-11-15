/**
 * Lovable `.lab-motif`: an original offset rhombus lattice inspired by woven rhythm
 * (mint chevrons at 7 % and gold dots at 18 %, 28-pt tile). Decorative only.
 */
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon, Rect } from 'react-native-svg';

import { palette } from './theme';

export function Motif({ opacity = 1, style }: { opacity?: number; style?: StyleProp<ViewStyle> }) {
  const id = `motif${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={28} height={28}>
            <Polygon points="0,0 14,0 0,14" fill={palette.mint} fillOpacity={0.07} />
            <Polygon points="14,0 28,0 28,14" fill={palette.mint} fillOpacity={0.07} />
            <Circle cx={7} cy={7} r={1} fill={palette.gold} fillOpacity={0.18} />
            <Circle cx={21} cy={7} r={1} fill={palette.gold} fillOpacity={0.18} />
            <Circle cx={7} cy={21} r={1} fill={palette.gold} fillOpacity={0.18} />
            <Circle cx={21} cy={21} r={1} fill={palette.gold} fillOpacity={0.18} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
      </Svg>
    </View>
  );
}
