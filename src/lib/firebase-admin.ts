import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import type { Storage } from 'firebase-admin/storage';

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n').trim();

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'ckkk-576e7';
    let clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    // Resilient fallback for Vercel Serverless environment where .env.local is omitted
    const FALLBACK_KEY_B64 = "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRRExWVU91bXZ1cm9jcXUKaUIzNTZCNFc1N3F2Q2Zqd1JEMGZwUGI4Z2RGOUc1Y2hkc25YS1YyYWQyZzZ6a0J2Ny9qbzViNkF2WTMvL3BVLwpVdGZpV3hrcFY5SWxqelJaUjFYK01nUE5YdXBNSFRRWTRVZCtpdExFL1dISFFBSFJTSHJyRzVEUk93VXU3Sm42CkFsTWgxQjZxdEhBS1pOb0VyY0U4aTV3TExUcmRwYk9qeEpDb0pRVm12MjYwTkxFanBHa2p4RVpDMEw4eTlubEEKR2dvMlZPV2xCOTFrWGxneUt2MXJ0TExXYTRsZzIvdmxjUGJ3Q2tIZW52Wk5hdVJuZXBCR1U4SEJnM2V2cUZXSgpzWENPNFp1MWlnVk52NWJBOEh5cmFsUjI3YnNSMURrL1FsTGptd2pNdkVDYlFnWG9EdHh4REdMZmpxYXk3NFBtCmxxcnMyeWJoQWdNQkFBRUNnZ0VBQlhzT1lIbjM5NmZjUlRrUkNjZnFhN2FpVHc2SFFiNnRJUm02dUpLdE9XQ1IKZ2Nyb1pON09FWmhQWEdwcnpUaWNMbmJtM0NSLzI5c2FYY01YWTVnT0JSSERiZFMrMWZzNHc2bklkWFF0LzVBMwo4OFc2dmh2eTAzRjYvYnBwY2lFd2d2N1N0L2tOeWphQmJmNDdER25oeTdzaVcvMWM3UXhiN1l4YnorZFBzMkswCk1XTFZzYUQvVnBPNCs0Q2ZWSG1lekZmT3dNTWhQMnhEdnU4OFJmbmVQbGJISjA3Uzh2RnI1Zy9zb3ZCMmlvZzgKM2lqUzYrN0Y4azJzSWNSdEFCejVNL0hzTkE5U3R4R1BLZE5Ycy9rbEc3SmJIRmRsSVQwcno1dWtsRE5XVTdWUgpEc09oTERkemNZY3YwRjQvQ2pSRHp4aS9WN1hjaVo0UlBhNXU2T0tQQXdLQmdRRDBQOFcwcUx0MXJKaVRmUkduCmVpVnNXeGticnhoOXozRjd6Ni80UnRtVWpESDVkUVU3RWlOMVQrNnJSV1BrTjAySmd0R1RLWHhRaDU2YjlNN00Kc090SjlLZE9qK1pnOUp3M3J2dmhHNzRDVnRDUmkyeTA1V1dxUEwwRm4vNVgxSmRUQ1JiOE8vUzdCS0xRYTk5dgpQV1RyT2hKeHVlYlM3dWZlMVI4cGFlVExzd0tCZ1FEVkhZK011MnJlMTZKUnA0R3h3U0FHa2p4dkhSN0l6dWNsCi9OZ0lvVWI0RmliQnBpckdXaWt0QjNBaTFNUGw4U1J6Ni9wMXRWcHhBSzlIcVFnWFdGMnFuWExBSmdRb3QySjAKZGRneElrdk5hMFBneUVPK0N3ZytFU05qNENaTzN4ZUxRMVJ1cVV4YnNtcEE3dld4Nnk1bGlGY2lSK1pBWXNZVwozY2NnT1g0cEd3S0JnQXl5a0FXZlMvZUhISHQyWWdlUjJ3WXlDakVkUGltME1oTWNyZW83VEs1alIyblBncEVhCmxVdFE5M2hoNkJxQ0lYN0hsVHVRU1kwcUw3MnQwVjVreUNhVkdHbUdJNVRnd29wR2g0T2hYSlJralAwMEFWZTYKSVRualpIUTVhQkNLMWI4VVZ1U1AvVjRIbEtzL0lHTjVEcGtIOE5PR3RaQTdxVVExVWlSbUErWHZBb0dCQUpHRwpyZyticTA2Z1VPY1JTeTdtZ2NmNjgrbXNLT2xXMytEQTE0U05ITGtyNXlzMUhPQjFrTWgrMjhQdEpoaE9vbVhHCkxqRlN0WCtVeUJ4WEFIOXdpQVdKbm1JM2szOTZPbkRzUjhURmRwMi9NWXE5TmdULzQ1RCtndndnaEFnM3J3d1oKM2YzeS9ZRmdRODR6WHZNdmRXOC91c0JkK0l6ZTVnV1hTL0psVUJFaEFvR0FTdjJscjFQU2NoSzdPMlBhQUFIZworK0l2YXl5dC9XK3J1QnNacmNoQ1JCZHFuVUNPejNueGJaVGxCZG9KTjJpOUsra1pNS0ViUHZHQjJ0eUxKVGgwCjNSNWlnUnQ3dG0rUDBNNUd5UUtUaHlHL3N3d3dXUklYL2d2ZDY0ZCt1WmV1SnpRSm92UUU0RkpmVm1wc3pndWUKUm5TYUVLem1wQ2VXSHZRZzJOdTgrN009Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K";
    const FALLBACK_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@ckkk-576e7.iam.gserviceaccount.com";

    if (!privateKey && FALLBACK_KEY_B64) {
      privateKey = Buffer.from(FALLBACK_KEY_B64, "base64").toString("utf8");
    }
    if (!clientEmail) {
      clientEmail = FALLBACK_CLIENT_EMAIL;
    }

    if (projectId && clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      return initializeApp({
        projectId: 'ckkk-576e7',
      });
    }
  } catch (error: any) {
    console.error('Firebase Admin App initialization error:', error);
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp({ projectId: 'ckkk-576e7' });
  }
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  return getFirestore(app);
}

export function getAdminAuth(): Auth {
  const app = getAdminApp();
  return getAuth(app);
}

export function getAdminMessaging(): Messaging {
  const app = getAdminApp();
  return getMessaging(app);
}

export function getAdminStorage(): Storage {
  const app = getAdminApp();
  return getStorage(app);
}
