import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('configure', ROOT / 'scripts/configure-android-photo-picker.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AndroidPickerConfigurationTest(unittest.TestCase):
    def test_configures_picker_without_broad_access_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            main = root / 'android/app/src/main'
            package = main / 'java/com/britiumexpress/rider'
            package.mkdir(parents=True)
            (main / 'AndroidManifest.xml').write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/><application/></manifest>')
            activity = package / 'MainActivity.java'
            activity.write_text('package com.britiumexpress.rider; import com.getcapacitor.BridgeActivity; public class MainActivity extends BridgeActivity {}')
            gradle = root / 'android/app/build.gradle'
            gradle.write_text('android {}')
            (root / 'android/variables.gradle').write_text('ext { compileSdkVersion = 35\ntargetSdkVersion = 35\nminSdkVersion = 24 }')
            shutil.copytree(ROOT / 'android-assets', root / 'android-assets')
            module.configure(root)
            module.configure(root)
            manifest = ET.parse(main / 'AndroidManifest.xml').getroot()
            names = [p.get(f'{{{module.ANDROID}}}name') for p in manifest.findall('uses-permission')]
            self.assertEqual(names, ['android.permission.CAMERA'])
            self.assertEqual(len(manifest.findall('application/service')), 1)
            self.assertEqual(len(manifest.findall('queries/intent')), 1)
            self.assertEqual(activity.read_text().count('registerPlugin(BritiumPhotoPickerPlugin.class)'), 1)
            self.assertEqual(gradle.read_text().count('androidx.photopicker:photopicker:1.0.0-alpha02'), 1)
            self.assertIn('compileSdkVersion = 36', (root / 'android/variables.gradle').read_text())
            self.assertIn('minSdkVersion = 24', (root / 'android/variables.gradle').read_text())

if __name__ == '__main__':
    unittest.main()
