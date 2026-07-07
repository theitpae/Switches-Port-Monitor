"use client";
import { useVpn } from '../context/VpnContext';
import VpnWarningModal from './VpnWarningModal';

// Client component ที่ render VPN warning modal เมื่อ showWarning = true
export default function VpnGlobalWatcher() {
  const { showWarning, dismissWarning } = useVpn();

  if (!showWarning) return null;

  return <VpnWarningModal onDismiss={dismissWarning} />;
}
