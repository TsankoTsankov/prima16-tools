/** Prima16 engineering calculators. See docs/FORMULAS.md */
(function (root) {
  const ISO = { BALL_EXPONENT: 3, ROLLER_EXPONENT: 10 / 3 };
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }
  function bearingL10(C, P, type) {
    C = num(C); P = num(P);
    if (!(C > 0 && P > 0)) return { error: "C and P must be > 0" };
    const p = type === "roller" ? ISO.ROLLER_EXPONENT : ISO.BALL_EXPONENT;
    return { L10: Math.pow(C / P, p), p };
  }
  function bearingL10h(L10, rpm) {
    rpm = num(rpm);
    if (!(L10 > 0 && rpm > 0)) return { error: "speed must be > 0" };
    return { hours: (L10 * 1e6) / (60 * rpm) };
  }
  function bearingEquivalentLoad(Fr, Fa, X, Y) {
    Fr = num(Fr); Fa = num(Fa) || 0; X = num(X); Y = num(Y);
    if (!(Fr >= 0)) return { error: "Fr required" };
    if (!Number.isFinite(X)) X = 1;
    if (!Number.isFinite(Y)) Y = Fa > 0 ? 0.5 : 0;
    return { P: X * Fr + Y * Fa, X, Y };
  }
  function bearingReplacementCost(bearingCost, labour, hours, downtimeCost) {
    bearingCost = num(bearingCost); labour = num(labour) || 0; hours = num(hours); downtimeCost = num(downtimeCost) || 0;
    if (!(hours > 0)) return { error: "life hours must be > 0" };
    const total = bearingCost + labour + downtimeCost;
    return { total, costPerHour: total / hours };
  }
  function pressBrakeTonnage(t_in, V_in, L_in, uts_psi) {
    t_in = num(t_in); V_in = num(V_in); L_in = num(L_in); uts_psi = num(uts_psi);
    if (!(t_in > 0 && V_in > 0 && L_in > 0 && uts_psi > 0)) return { error: "thickness, V, length and UTS must be > 0" };
    const factor = uts_psi / 60000;
    const tons = ((575 * t_in * t_in) / V_in / 12) * L_in * factor;
    return { tons, tonsPerFoot: tons / (L_in / 12), factor, ri: 0.16 * V_in, minFlange: 0.7 * V_in, vRatio: V_in / t_in };
  }
  function mmToIn(mm) { return num(mm) / 25.4; }
  function inToMm(inch) { return num(inch) * 25.4; }
  function mpaToPsi(mpa) { return num(mpa) * 145.0377; }
  function bendAllowance(T, R, Adeg, K) {
    T = num(T); R = num(R); Adeg = num(Adeg); K = num(K);
    if (!(T > 0 && R >= 0 && Adeg > 0 && Adeg < 180)) return { error: "bad bend inputs" };
    if (!Number.isFinite(K)) K = 0.446;
    const Arad = (Adeg * Math.PI) / 180;
    const BA = Arad * (R + K * T);
    const OSSB = (R + T) * Math.tan(Arad / 2);
    return { BA, BD: 2 * OSSB - BA, OSSB, K };
  }
  function sheetWeight(Lmm, Wmm, Tmm, density) {
    Lmm = num(Lmm); Wmm = num(Wmm); Tmm = num(Tmm); density = num(density) || 7.85;
    if (!(Lmm > 0 && Wmm > 0 && Tmm > 0)) return { error: "dimensions must be > 0" };
    const kg = (Lmm * Wmm * Tmm * density) / 1e6;
    return { kg, lb: kg * 2.20462262 };
  }
  function airPressureDrop(L_ft, Q_scfm, d_in, P_psig) {
    L_ft = num(L_ft); Q_scfm = num(Q_scfm); d_in = num(d_in); P_psig = num(P_psig);
    if (!(L_ft > 0 && Q_scfm > 0 && d_in > 0 && P_psig > 0)) return { error: "length, flow, diameter and pressure must be > 0" };
    const dp = (0.1025 * L_ft * Math.pow(Q_scfm, 1.85)) / (Math.pow(d_in, 5) * (P_psig + 14.7));
    const Q_actual = Q_scfm * (14.7 / (P_psig + 14.7));
    const area_ft2 = Math.PI * Math.pow(d_in / 24, 2);
    const vel_fpm = Q_actual / area_ft2;
    let verdict = "ok";
    if (dp > 5) verdict = "undersized"; else if (dp > 3) verdict = "marginal";
    return { dp, vel_fpm, vel_ms: vel_fpm * 0.00508, Q_actual, verdict };
  }
  const SCH40_ID = { "0.5": 0.622, "0.75": 0.824, "1": 1.049, "1.25": 1.38, "1.5": 1.61, "2": 2.067, "2.5": 2.469, "3": 3.068, "4": 4.026 };
  function suggestPipe(L_ft, Q_scfm, P_psig, maxDp) {
    maxDp = num(maxDp) || 3;
    const sizes = Object.keys(SCH40_ID).map(Number).sort((a, b) => a - b);
    for (const nom of sizes) {
      const r = airPressureDrop(L_ft, Q_scfm, SCH40_ID[String(nom)], P_psig);
      if (!r.error && r.dp <= maxDp) return { nominalIn: nom, idIn: SCH40_ID[String(nom)], ...r };
    }
    return { error: "no Schedule 40 size <= 4 in stays under the drop limit" };
  }
  function cylinderForce(P, d, unit) {
    P = num(P); d = num(d);
    if (!(P > 0 && d > 0)) return { error: "pressure and bore must be > 0" };
    if (unit === "metric") {
      const F_N = P * 1e5 * Math.PI * Math.pow(d / 2000, 2);
      return { F_N, F_kgf: F_N / 9.80665, F_lbf: F_N / 4.44822 };
    }
    const F_lbf = P * Math.PI * Math.pow(d / 2, 2);
    return { F_lbf, F_N: F_lbf * 4.44822 };
  }
  function compressorCost(scfm, hours, kwhPrice, scfmPerHp) {
    scfm = num(scfm); hours = num(hours); kwhPrice = num(kwhPrice); scfmPerHp = num(scfmPerHp) || 4;
    if (!(scfm > 0 && hours >= 0 && kwhPrice >= 0)) return { error: "bad cost inputs" };
    const hp = scfm / scfmPerHp;
    const kW = (hp * 0.746) / 0.92;
    return { hp, kW, energy: kW * hours, cost: kW * hours * kwhPrice };
  }
  const api = { ISO, bearingL10, bearingL10h, bearingEquivalentLoad, bearingReplacementCost, pressBrakeTonnage, mmToIn, inToMm, mpaToPsi, bendAllowance, sheetWeight, airPressureDrop, suggestPipe, SCH40_ID, cylinderForce, compressorCost };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.P16 = api;
  if (typeof globalThis !== "undefined") globalThis.P16 = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
