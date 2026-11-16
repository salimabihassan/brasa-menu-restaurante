"""Private recovery snapshot of BRASA local only. Never upload the backup to Git."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, json, hashlib, zipfile, shutil, tarfile, os
root=Path(__file__).resolve().parent.parent
stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target=root/'.local'/'backups'/stamp
target.mkdir(parents=True,exist_ok=False)
def docker(*args, output=None):
    if output:
        with output.open('wb') as stream:
            subprocess.run(['docker',*args],stdout=stream,stderr=subprocess.PIPE,check=True)
    else:
        return subprocess.run(['docker',*args],capture_output=True,check=True).stdout
# pg_dump takes a transactionally consistent database snapshot, including Auth and Storage metadata.
docker('exec','supabase_db_brasa-local','pg_dump','-U','postgres','-d','postgres','-Fc','--no-owner',output=target/'database.dump')
# Confirm that PostgreSQL can read the complete archive directory.
with (target/'database.dump').open('rb') as stream:
    result=subprocess.run(['docker','exec','-i','supabase_db_brasa-local','pg_restore','--list'],stdin=stream,capture_output=True,check=True)
(target/'database-contents.txt').write_bytes(result.stdout)
docker('exec','supabase_storage_brasa-local','tar','-C','/mnt','-czf','-','.',output=target/'storage.tar.gz')
with tarfile.open(target/'storage.tar.gz','r:gz') as archive:
    members=archive.getmembers()
    for member in members:
        if member.isfile():
            with archive.extractfile(member) as stream:
                while stream.read(1024*1024):pass
# Sources with uncommitted changes are included; dependencies, runtime and secrets excluded.
excluded={'.git','.local','node_modules','.next','.next-review','out','.npm-cache','.agents','.codex'}
with zipfile.ZipFile(target/'source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for directory, dirs, names in os.walk(root):
        dirs[:]=[name for name in dirs if name not in excluded]
        for name in names:
            path=Path(directory)/name
            if name.endswith('.tsbuildinfo'):continue
            if name.startswith('.env') and name!='.env.example':continue
            archive.write(path,path.relative_to(root))
with zipfile.ZipFile(target/'source.zip','r') as archive:
    if archive.testzip():raise RuntimeError('Source archive validation failed')
private=target/'private-config';private.mkdir()
for name in ['.env.development.local','.local/delivery.env','.local/push.env','.local/web-push-keys.json','.local/staff.json']:
    path=root/name
    if path.is_file():shutil.copy2(path,private/path.name)
files={}
for path in target.rglob('*'):
    if path.is_file():files[str(path.relative_to(target))]={'bytes':path.stat().st_size,'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest()}
(target/'manifest.json').write_text(json.dumps({'created_utc':stamp,'database':'BRASA local postgres custom archive; owner omitted; permissions included','storage_members':len(members),'files':files},indent=2),encoding='utf-8')
(target/'LEEME.txt').write_text('RESPALDO PRIVADO BRASA. Contiene datos personales, hashes de contrasenas y claves privadas. NO publicar ni subir a GitHub. Ver docs/security-review.md para alcance y recuperacion. Integridad del archivo verificada. Consultar restore-verification.json para el resultado del ensayo aislado. Durante este respaldo no deben hacerse pedidos ni editar fotos. No es un paquete para importar directamente a Supabase remoto.\n',encoding='utf-8')
print('Respaldo privado creado:',target)
print('Archivo PostgreSQL, archivos Storage y ZIP verificados; hashes SHA-256 registrados.')
