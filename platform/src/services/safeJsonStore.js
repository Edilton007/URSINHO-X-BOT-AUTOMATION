// Armazém JSON com gravação atómica, cópias comprimidas e recuperação.
// Se o ficheiro principal desaparecer, tenta restaurar a cópia válida mais recente.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function carimbo(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function criarArmazem({ file, keep = 8, intervaloMs = 6 * 3600 * 1000, validar = () => true, nome = path.basename(file) }) {
    if (!file) throw new Error("O caminho do ficheiro é obrigatório.");
    const dir = path.dirname(file);
    const base = path.basename(file);
    let ultimoBackupMs = 0;

    function listarBackups() {
        try {
            return fs.readdirSync(dir)
                .filter((n) => n.startsWith(`${base}.bak-`) && n.endsWith(".gz"))
                .sort()
                .reverse()
                .map((n) => path.join(dir, n));
        } catch {
            return [];
        }
    }

    function lerJson(caminho) {
        let bytes = fs.readFileSync(caminho);
        if (caminho.endsWith(".gz")) bytes = zlib.gunzipSync(bytes);
        const dados = JSON.parse(bytes.toString("utf8"));
        if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
            throw new Error("conteúdo não é um objeto");
        }
        validar(dados);
        return dados;
    }

    function backupSeNecessario() {
        try {
            if (!fs.existsSync(file)) return;
            if (ultimoBackupMs !== 0 && Date.now() - ultimoBackupMs < intervaloMs) return;
            const destino = `${file}.bak-${carimbo()}.gz`;
            fs.writeFileSync(destino, zlib.gzipSync(fs.readFileSync(file)));
            ultimoBackupMs = Date.now();
            for (const antigo of listarBackups().slice(Math.max(1, keep))) {
                try { fs.unlinkSync(antigo); } catch {}
            }
        } catch (err) {
            console.error(`Aviso: cópia de segurança de ${nome} falhou:`, err?.message || err);
        }
    }

    function gravar(dados, { criarBackup = true } = {}) {
        validar(dados);
        fs.mkdirSync(dir, { recursive: true });
        if (criarBackup) backupSeNecessario();
        const tmp = `${file}.tmp`;
        const fd = fs.openSync(tmp, "w");
        try {
            fs.writeSync(fd, JSON.stringify(dados, null, 2), null, "utf8");
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, file);
        // Tenta persistir também a alteração de diretório em sistemas POSIX.
        try {
            const dirFd = fs.openSync(dir, "r");
            try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
        } catch {}
    }

    function restaurarBackup({ copiaCorrompida = null } = {}) {
        for (const backup of listarBackups()) {
            try {
                const dados = lerJson(backup);
                // Não criar uma nova cópia da base corrompida durante a recuperação.
                gravar(dados, { criarBackup: false });
                console.warn(`⚠️ ${nome} restaurado da cópia ${path.basename(backup)}${copiaCorrompida ? ` (original preservado em ${path.basename(copiaCorrompida)})` : ""}.`);
                return { estado: "restaurado", dados, backup };
            } catch (err) {
                console.warn(`Cópia ignorada (${path.basename(backup)}): ${err?.message || err}`);
            }
        }
        return null;
    }

    function ler() {
        if (!fs.existsSync(file)) {
            const backupsExistentes = listarBackups();
            const restaurado = restaurarBackup();
            if (restaurado) return restaurado;
            if (backupsExistentes.length > 0) {
                return { estado: "ilegivel", erro: "ficheiro principal ausente e nenhuma cópia válida disponível", copia: null };
            }
            return { estado: "ausente" };
        }

        try {
            return { estado: "ok", dados: lerJson(file) };
        } catch (erro) {
            const copia = `${file}.corrompido-${Date.now()}`;
            try { fs.copyFileSync(file, copia); } catch {}
            console.error(`❌ ${nome} ilegível (${erro?.message}). Cópia em ${path.basename(copia)}.`);
            const restaurado = restaurarBackup({ copiaCorrompida: copia });
            if (restaurado) return restaurado;
            return { estado: "ilegivel", erro: erro?.message || String(erro), copia };
        }
    }

    return { ler, gravar, listarBackups, file };
}

module.exports = { criarArmazem };
