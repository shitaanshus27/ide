import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/analytics';
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { useRouter } from 'next/router';
import type firebaseType from 'firebase';
import animals from '../scripts/animals';
import colorFromUserId from '../scripts/colorFromUserId';
import { useAtom } from 'jotai';
import { defaultPermissionAtom } from '../atoms/workspace';
import { firebaseUserAtom } from '../atoms/firebaseAtoms';
import { userNameAtom } from '../atoms/userSettings';

const firebaseConfig = {
  apiKey: 'AIzaSyDAYhsX5I8X1l_hu6AhBZx8prDdvY2i2EA',
  authDomain: 'live-cp-ide.firebaseapp.com',
  databaseURL: 'https://live-cp-ide.firebaseio.com',
  projectId: 'live-cp-ide',
  storageBucket: 'live-cp-ide.appspot.com',
  messagingSenderId: '350143604950',
  appId: '1:350143604950:web:3a5716645632d42def0177',
  measurementId: 'G-V2G3NLWBWF',
};

if (typeof window !== 'undefined') {
  // firepad needs access to firebase
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.firebase = firebase;
}

if (!firebase.apps?.length) {
  firebase.initializeApp(firebaseConfig);
  if (typeof window !== 'undefined' && firebase.analytics) firebase.analytics();
}

export const FirebaseRefContext = createContext<
  | {
      docRef: firebaseType.database.Reference | null;
      userRef: firebaseType.database.Reference | null;
    }
  | undefined
>(undefined);

function getFirebaseRef(
  hash: string | null | undefined
): firebaseType.database.Reference {
  let ref = firebase.database().ref();
  if (hash) {
    ref = ref.child('-' + hash);
  } else {
    ref = ref.push(); // generate unique location.
    window.history.replaceState({}, '', '/' + ref.key!.substr(1));
  }
  return ref;
}

export const FirebaseRefProvider: React.FC = ({ children }) => {
  const router = useRouter();
  const [ref, setRef] = useState<firebaseType.database.Reference | null>(null);
  const [
    userRef,
    setUserRef,
  ] = useState<firebaseType.database.Reference | null>(null);
  const [, setFirebaseUser] = useAtom(firebaseUserAtom);
  const [, setDefaultPermission] = useAtom(defaultPermissionAtom);
  const [, setUserName] = useAtom(userNameAtom);

  useEffect(() => {
    if (!router.isReady) return;

    firebase
      .auth()
      .signInAnonymously()
      .catch(error => {
        const errorCode = error.code;
        const errorMessage = error.message;
        alert('Error signing in: ' + errorCode + ' ' + errorMessage);
      });

    const joinWorkspaceForFirstTime = (
      userRef: firebaseType.database.Reference,
      permission: 'OWNER' | 'READ_WRITE' | 'READ' | 'PRIVATE',
      name: string
    ) => {
      userRef.update({
        name: name,
        color: colorFromUserId(userRef.key),
        ...(permission === 'OWNER' ? { permission } : {}),
        connections: {
          first: firebase.database.ServerValue.TIMESTAMP,
        },
      });
      userRef.child('connections').child('first').onDisconnect().remove();
    };

    const joinWorkspace = (
      userRef: firebaseType.database.Reference,
      permission: 'OWNER' | 'READ_WRITE' | 'READ' | 'PRIVATE',
      name: string
    ) => {
      userRef.once('value').then(snap => {
        if (permission === 'PRIVATE' && !snap.val()?.permission) {
          alert('This file is private.');
          window.location.href = '/';
        }
        if (!snap.val()?.name) {
          // first time on this doc, need to add to user list
          joinWorkspaceForFirstTime(userRef, permission, name);
        } else {
          // update name as necessary
          if (snap.val().name !== name) {
            userRef.child('name').set(name);
          }
          const connectionRef = userRef
            .child('connections')
            .push(firebase.database.ServerValue.TIMESTAMP);
          connectionRef.onDisconnect().remove();
        }
      });
    };

    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      setFirebaseUser(user);
      if (user) {
        let name =
          'Anonymous ' + animals[Math.floor(animals.length * Math.random())];
        if (!user.displayName) {
          user.updateProfile({ displayName: name });
        } else {
          name = user.displayName;
        }
        setUserName(name);

        const uid = user.uid;

        let queryId: string | undefined;
        if (Array.isArray(router.query.id)) {
          queryId = router.query.id[0];
        } else {
          queryId = router.query.id;
        }
        const ref = getFirebaseRef(queryId);
        const userRef = ref.child('users').child(uid);

        if (queryId) {
          ref
            .child('settings')
            .child('defaultPermission')
            .once('value')
            .then(snap => {
              let permission: 'OWNER' | 'READ_WRITE' | 'READ' | 'PRIVATE';
              if (snap.exists()) {
                permission = snap.val();
              } else {
                // new doc, make me the owner
                permission = 'OWNER';

                ref
                  .child('settings')
                  .child('defaultPermission')
                  .set('READ_WRITE');
              }

              setDefaultPermission(snap.val() || 'READ_WRITE');
              joinWorkspace(userRef, permission, name);
            });
        } else {
          setDefaultPermission('READ_WRITE');
          joinWorkspaceForFirstTime(userRef, 'OWNER', name);
        }

        setRef(ref);
        setUserRef(userRef);
      }
    });

    return () => unsubscribe();

    // we only want to run this once when the router is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const value = useMemo(() => ({ docRef: ref, userRef }), [ref, userRef]);

  return (
    <FirebaseRefContext.Provider value={value}>
      {children}
    </FirebaseRefContext.Provider>
  );
};

export const useFirebaseRef = (): firebaseType.database.Reference | null => {
  const ref = useContext(FirebaseRefContext);
  if (ref === undefined) {
    throw new Error(
      'useFirebaseRef() must be used inside a FirebaseRefProvider'
    );
  }
  return ref?.docRef;
};

export const useUserRef = (): firebaseType.database.Reference | null => {
  const ref = useContext(FirebaseRefContext);
  if (ref === undefined) {
    throw new Error('useUserRef() must be used inside a FirebaseRefProvider');
  }
  return ref?.userRef;
};
