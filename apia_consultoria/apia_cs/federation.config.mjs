import { withNativeFederation, shareAll } from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'apia_cs',

  exposes: {
    './Routes': './src/app/app.routes.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],
});
