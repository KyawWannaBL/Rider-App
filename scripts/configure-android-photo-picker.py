"""Install the native picker into Capacitor's generated Android project (idempotent)."""
import re
import shutil
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = 'http://schemas.android.com/apk/res/android'
TOOLS = 'http://schemas.android.com/tools'
ET.register_namespace('android', ANDROID)
ET.register_namespace('tools', TOOLS)

def configure(root=ROOT):
    app = root / 'android/app'
    manifest = app / 'src/main/AndroidManifest.xml'
    tree = ET.parse(manifest)
    element = tree.getroot()
    application = element.find('application')
    if application is None:
        raise RuntimeError('Generated Android application is missing')
    forbidden = {'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'}
    for item in list(element.findall('uses-permission')):
        if item.get(f'{{{ANDROID}}}name') in forbidden:
            element.remove(item)
    if not any(item.get(f'{{{ANDROID}}}name') == 'android.permission.CAMERA' for item in element.findall('uses-permission')):
        element.insert(0, ET.Element('uses-permission', {f'{{{ANDROID}}}name': 'android.permission.CAMERA'}))
    service_name = 'com.google.android.gms.metadata.ModuleDependencies'
    service = next((s for s in application.findall('service') if s.get(f'{{{ANDROID}}}name') == service_name), None)
    if service is None:
        service = ET.SubElement(application, 'service', {f'{{{ANDROID}}}name': service_name, f'{{{ANDROID}}}enabled': 'false', f'{{{ANDROID}}}exported': 'false', f'{{{TOOLS}}}ignore': 'MissingClass'})
        intent = ET.SubElement(service, 'intent-filter')
        ET.SubElement(intent, 'action', {f'{{{ANDROID}}}name': 'com.google.android.gms.metadata.MODULE_DEPENDENCIES'})
        ET.SubElement(service, 'meta-data', {f'{{{ANDROID}}}name': 'photopicker_activity:0:required', f'{{{ANDROID}}}value': ''})
    queries = element.find('queries')
    if queries is None:
        queries = ET.SubElement(element, 'queries')
    embedded_action = 'com.android.photopicker.core.embedded.EmbeddedService.BIND'
    if not any(a.get(f'{{{ANDROID}}}name') == embedded_action for a in queries.findall('intent/action')):
        ET.SubElement(ET.SubElement(queries, 'intent'), 'action', {f'{{{ANDROID}}}name': embedded_action})
    ET.indent(tree, space='    ')
    tree.write(manifest, encoding='utf-8', xml_declaration=True)

    package = app / 'src/main/java/com/britiumexpress/rider'
    package.mkdir(parents=True, exist_ok=True)
    for name in ('BritiumPhotoPickerPlugin.java', 'EmbeddedPickerDialog.java'):
        shutil.copy2(root / 'android-assets/photo-picker' / name, package / name)
    activity = package / 'MainActivity.java'
    source = activity.read_text()
    if 'registerPlugin(BritiumPhotoPickerPlugin.class)' not in source:
        on_create = re.search(r'public\s+void\s+onCreate\s*\([^)]*\)\s*\{', source)
        if on_create:
            source = source[:on_create.end()] + '\n        registerPlugin(BritiumPhotoPickerPlugin.class);' + source[on_create.end():]
        else:
            marker = re.search(r'class\s+MainActivity\s+extends\s+BridgeActivity\s*\{', source)
            if not marker:
                raise RuntimeError('Cannot register photo picker in generated MainActivity')
            method = '\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(BritiumPhotoPickerPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n'
            source = source[:marker.end()] + method + source[marker.end():]
        activity.write_text(source)
    gradle = app / 'build.gradle'
    source = gradle.read_text()
    if '// Britium native photo picker' not in source:
        source += '\n// Britium native photo picker\ndependencies {\n    implementation "androidx.photopicker:photopicker:1.0.0-alpha02"\n    implementation "androidx.exifinterface:exifinterface:1.3.7"\n}\n'
        gradle.write_text(source)
    variables = root / 'android/variables.gradle'
    source = variables.read_text()
    for name, value in [('compileSdkVersion', 36), ('targetSdkVersion', 36)]:
        source, count = re.subn(r'(' + name + r'\s*=\s*)\d+', lambda m: m[1] + str(value), source, count=1)
        if count != 1:
            raise RuntimeError('Missing SDK configuration: ' + name)
    variables.write_text(source)

if __name__ == '__main__':
    configure()
    print('Native embedded picker, standard-picker backport and selected-photo permissions configured')
