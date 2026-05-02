const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync(PROJECTS_DIR);

class FileManager {
    // Parse AI response and extract files
    parseFilesFromResponse(response) {
        const files = [];
        const fileRegex = /===FILE:\s*(.+?)===\n([\s\S]*?)===ENDFILE===/g;
        let match;
        
        while ((match = fileRegex.exec(response)) !== null) {
            files.push({
                filename: match[1].trim(),
                content: match[2].trim()
            });
        }

        // If no files found with ===FILE=== format, try markdown code blocks
        if (files.length === 0) {
            const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
            let fileIndex = 1;
            while ((match = codeBlockRegex.exec(response)) !== null) {
                files.push({
                    filename: `file_${fileIndex}.txt`,
                    content: match[1].trim()
                });
                fileIndex++;
            }
        }

        return files;
    }

    // Create project directory with files
    async createProject(projectName, files) {
        const projectDir = path.join(PROJECTS_DIR, `${projectName}_${Date.now()}`);
        fs.ensureDirSync(projectDir);

        for (const file of files) {
            const filePath = path.join(projectDir, file.filename);
            fs.ensureDirSync(path.dirname(filePath));
            await fs.writeFile(filePath, file.content);
        }

        return projectDir;
    }

    // Create zip from project directory
    async createZip(projectDir, zipName) {
        const zipPath = path.join(TEMP_DIR, `${zipName}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve(zipPath));
            archive.on('error', reject);
            archive.on('warning', (err) => {
                if (err.code === 'ENOENT') console.warn('Archive warning:', err);
                else reject(err);
            });

            archive.pipe(output);
            archive.directory(projectDir, false);
            archive.finalize();
        });
    }

    // Generate project from AI response and create zip
    async generateProjectZip(projectName, aiResponse, progressCallback) {
        progressCallback(30);
        
        const files = this.parseFilesFromResponse(aiResponse);
        if (files.length === 0) {
            throw new Error('No files found in AI response');
        }

        progressCallback(50);
        const projectDir = await this.createProject(projectName, files);
        
        progressCallback(70);
        const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const zipPath = await this.createZip(projectDir, safeName);
        
        progressCallback(100);
        return { zipPath, fileCount: files.length, projectDir };
    }

    // Create a single file
    async createFile(filename, content) {
        const filePath = path.join(TEMP_DIR, filename);
        await fs.writeFile(filePath, content);
        return filePath;
    }

    // Clean up old temp files (keep last 50)
    async cleanup() {
        try {
            const files = await fs.readdir(TEMP_DIR);
            const sorted = files
                .map(f => ({ name: f, time: fs.statSync(path.join(TEMP_DIR, f)).mtime }))
                .sort((a, b) => b.time - a.time);
            
            for (let i = 50; i < sorted.length; i++) {
                await fs.remove(path.join(TEMP_DIR, sorted[i].name));
            }
        } catch (e) {
            console.log('Cleanup error:', e.message);
        }
    }

    // Get file stats
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new FileManager();
