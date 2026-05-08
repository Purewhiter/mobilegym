export interface CompassState {
  /** 罗盘朝向角度 (0-360)，罗盘转盘会旋转到该角度 */
  headingDeg: number;
  /** 水平仪倾斜角度 */
  levelAngleDeg: number;
}

export interface CompassConfig {
  headingDeg: number;
  levelAngleDeg: number;
}

