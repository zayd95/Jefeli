/**
 * Former SMS-only screen. Phone sign-in now lives next to e-mail on « Se connecter »
 * (E-mail | Téléphone); old links land there with the phone tab selected.
 */
import { Redirect } from 'expo-router';

export default function PhoneSignIn() {
  return <Redirect href={{ pathname: '/sign-in', params: { method: 'phone' } }} />;
}
