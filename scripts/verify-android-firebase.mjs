import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const expectedProject = 'interplanetary-fund';
const expectedPackage = 'com.base6a67a778342a8fe05ee79cba.app';

const config = json('capacitor.config.json');
const projectJson = json('google-services.json');
const nativeJson = json('android/app/google-services.json');
const nativePackage = nativeJson.client?.[0]?.client_info?.android_client_info?.package_name;

assert.equal(config.appId, expectedPackage, 'Capacitor must match the Firebase Android package');
assert.equal(nativePackage, expectedPackage, 'Native google-services.json package mismatch');
assert.equal(nativeJson.project_info.project_id, expectedProject, 'Unexpected Firebase project');
assert.equal(projectJson.project_info.project_id, expectedProject, 'Unexpected root Firebase project');
assert.deepEqual(nativeJson, projectJson, 'Native config differs from the provided root config');
assert.ok(!config.server?.url, 'Production Android must not rely on a remote live-reload server');
assert.equal(config.webDir, 'dist', 'Android bundles the existing IFund frontend');

const appGradle = read('android/app/build.gradle');
const rootGradle = read('android/build.gradle');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const packageJson = json('package.json');
const nativeActivity = read('android/app/src/main/java/com/base6a67a778342a8fe05ee79cba/app/MainActivity.java');

assert.ok(appGradle.includes('applicationId "' + expectedPackage + '"'), 'Incorrect Android applicationId');
assert.ok(appGradle.includes("implementation platform('com.google.firebase:firebase-bom:35.0.0')"), 'Missing Firebase BoM');
assert.ok(appGradle.includes("implementation 'com.google.firebase:firebase-common'"), 'Missing basic Firebase runtime');
assert.ok(appGradle.includes("apply plugin: 'com.google.gms.google-services'"), 'Google Services plugin must apply');
assert.ok(rootGradle.includes("classpath 'com.google.gms:google-services:4.5.0'"), 'Incorrect Google Services Gradle plugin');
assert.ok(nativeActivity.includes('extends BridgeActivity'), 'Native Android activity not present');
assert.ok(androidManifest.includes('android:allowBackup="false"'), 'App data backup should not expose saved session tokens');
assert.ok(androidManifest.includes('android.permission.INTERNET'), 'Android web app requires Internet access');
assert.equal(packageJson.dependencies['@capacitor/core'], '8.4.3');
assert.equal(packageJson.dependencies['@capacitor/android'], '8.4.3');
assert.equal(packageJson.devDependencies['@capacitor/cli'], '8.4.3');

assert.ok(read('src/pages/Login.jsx').includes('base44.auth.setToken'), 'Base44 authentication changed');
assert.ok(read('src/pages/Register.jsx').includes('base44.auth.register'), 'Base44 registration changed');
assert.ok(read('wrangler.toml').includes('IFUND_BASE44_ORIGIN'), 'Existing hosting data plane changed');
assert.equal(existsSync('firebase.json'), false, 'Firebase Hosting/deployment config not expected');

console.log('PASS: Android scaffold and Firebase config match; Base44 auth, hosting and existing account model are preserved.');
console.log('NOTE: Native APK/Google sign-in/OAuth/device testing remains required before Android release.');
