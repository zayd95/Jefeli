# Current official references — verify again during build

These official sources are useful starting points; the build agent should verify current installation/API instructions at execution time, because SDK versions change.

- Expo development builds (native modules, custom integrations): https://docs.expo.dev/develop/development-builds/introduction/
- Expo limitations and production guidance: https://docs.expo.dev/faq/
- Expo + Supabase integration: https://docs.expo.dev/guides/using-supabase/
- Supabase + Expo React Native: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
- Supabase RN auth: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase product docs: https://supabase.com/docs
- Stream Video React Native: https://getstream.io/video/docs/react-native/
- Stream SDK Expo installation and Expo Go restriction: https://getstream.io/video/docs/react-native/setup/installation/expo/
- Apple App Review Guidelines — section 1.2 UGC and privacy: https://developer.apple.com/app-store/review/guidelines/
- Expo image picker: https://docs.expo.dev/versions/latest/sdk/imagepicker/
- Expo camera: https://docs.expo.dev/versions/latest/sdk/camera/

**Important:** official APIs do NOT generally permit unrestricted import of all Facebook friends, automatic posting to every social platform, or unrestricted scraping. Consult official Meta app review/API details before implementing. Feature-flag unapproved integrations and use user-initiated native share sheets as reliable baseline.

**Owner decisions still needed before launch:** service accounts/credentials, domain/legal brand clearance, privacy policy and user terms approval, any paid live/SMS/provider plans, production signing/app-store accounts and explicit public-release authorization.
