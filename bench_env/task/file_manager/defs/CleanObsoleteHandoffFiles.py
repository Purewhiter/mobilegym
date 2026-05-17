from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.file_manager.app import FileSystem
from bench_env.task.judge import JudgeInput


class CleanObsoleteHandoffFiles(BaseTask):
    templates = [
        "打开文件里的 Download/项目交接，把旧的草稿、报价和备份文件清理掉，只保留当前版本；正式合同、上线计划和供应商清单不要动。"
    ]
    apps = ["file_manager"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "delete", "reasoning"]
    expected_changes = ["os.fileSystem"]

    target_paths = [
        "/sdcard/Download/项目交接/budget_draft_1.txt",
        "/sdcard/Download/项目交接/vendor_quote_1.pdf",
        "/sdcard/Download/项目交接/design_backup_1.bak",
    ]
    preserve_paths = [
        "/sdcard/Download/项目交接/budget_draft_0.txt",
        "/sdcard/Download/项目交接/vendor_quote_0.pdf",
        "/sdcard/Download/项目交接/design_backup_0.bak",
        "/sdcard/Download/项目交接/final_contract_1.pdf",
        "/sdcard/Download/项目交接/launch_plan_0.docx",
        "/sdcard/Download/项目交接/vendor_list_0.xlsx",
        "/sdcard/Download/项目交接/vendor_list_backup_1.xlsx",
        "/sdcard/Download/项目交接/launch_plan_draft_0.docx",
        "/sdcard/Download/项目交接/handoff_notes_1.txt",
        "/sdcard/Download/项目交接/client_requirements_1.docx",
    ]
    seed_files = [
        {
            "path": "/sdcard/Download/项目交接/budget_draft_1.txt",
            "content": (
                "Project handoff budget draft\n"
                "Scope: migration support, onsite training, two weeks of Q&A.\n"
                "Total budget: CNY 186,000.\n"
                "Pending: acceptance testing labor, weekend launch support, tax treatment."
            ),
            "mimeType": "text/plain",
            "createdAt": 1_773_277_800_000,
            "modifiedAt": 1_773_277_800_000,
        },
        {
            "path": "/sdcard/Download/项目交接/budget_draft_0.txt",
            "content": (
                "Project handoff budget draft\n"
                "Scope: migration support, onsite training, two weeks of Q&A, weekend launch support, acceptance testing review.\n"
                "Total budget: CNY 238,000.\n"
                "Included: taxes, travel, temporary server resources, vendor remote support windows.\n"
                "Note: finance reserved the April schedule; payment milestones match the signed contract."
            ),
            "mimeType": "text/plain",
            "createdAt": 1_773_973_800_000,
            "modifiedAt": 1_773_973_800_000,
        },
        {
            "path": "/sdcard/Download/项目交接/vendor_quote_1.pdf",
            "content": (
                "Vendor quotation\n"
                "Modules: data migration, basic training, remote Q&A.\n"
                "Amount: CNY 126,000. Onsite staffing and weekend support are not included.\n"
                "Notes: tax rate, warranty period, and payment milestones need commercial confirmation."
            ),
            "payloadKind": "pdf",
            "mimeType": "application/pdf",
            "createdAt": 1_773_278_400_000,
            "modifiedAt": 1_773_278_400_000,
        },
        {
            "path": "/sdcard/Download/项目交接/vendor_quote_0.pdf",
            "content": (
                "Vendor quotation\n"
                "Modules: data migration, basic training, remote Q&A, onsite staffing, weekend launch support, acceptance support.\n"
                "Amount: CNY 158,000, including tax and travel.\n"
                "Warranty: 30 days after launch.\n"
                "Payment: 40% after contract signing, 50% after launch acceptance, 10% after warranty closure.\n"
                "Notes: service boundaries were expanded according to the handoff meeting."
            ),
            "payloadKind": "pdf",
            "mimeType": "application/pdf",
            "createdAt": 1_773_974_400_000,
            "modifiedAt": 1_773_974_400_000,
        },
        {
            "path": "/sdcard/Download/项目交接/design_backup_1.bak",
            "content": (
                "Design asset backup\n"
                "Included: sign-in page, home navigation, permission dialog.\n"
                "Missing: audit log, fallback error page, handoff acceptance screenshots.\n"
                "Note: waiting for the final product review notes."
            ),
            "mimeType": "application/octet-stream",
            "createdAt": 1_773_279_000_000,
            "modifiedAt": 1_773_279_000_000,
        },
        {
            "path": "/sdcard/Download/项目交接/design_backup_0.bak",
            "content": (
                "Design asset backup\n"
                "Included: sign-in page, home navigation, permission dialog, audit log, fallback error page, handoff acceptance screenshots.\n"
                "Added: icon exports, dark-mode annotations, empty-state copy, field permission matrix.\n"
                "Note: aligned with the acceptance checklist in the launch plan and ready for handoff archive."
            ),
            "mimeType": "application/octet-stream",
            "createdAt": 1_773_975_000_000,
            "modifiedAt": 1_773_975_000_000,
        },
        {
            "path": "/sdcard/Download/项目交接/final_contract_1.pdf",
            "content": "Signed contract scan with seal pages, payment milestones, service scope, and acceptance terms.",
            "payloadKind": "pdf",
            "mimeType": "application/pdf",
            "createdAt": 1_774_336_200_000,
            "modifiedAt": 1_774_336_200_000,
        },
        {
            "path": "/sdcard/Download/项目交接/launch_plan_0.docx",
            "content": "Launch plan with freeze window, rollback plan, duty roster, acceptance owner, and post-launch watch period.",
            "payloadKind": "docx",
            "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "createdAt": 1_774_408_800_000,
            "modifiedAt": 1_774_408_800_000,
        },
        {
            "path": "/sdcard/Download/项目交接/vendor_list_0.xlsx",
            "content": "Vendor list with primary vendor, backup contacts, contract ID, support window, and emergency phone numbers.",
            "payloadKind": "xlsx",
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "createdAt": 1_774_409_400_000,
            "modifiedAt": 1_774_409_400_000,
        },
        {
            "path": "/sdcard/Download/项目交接/vendor_list_backup_1.xlsx",
            "content": "Vendor list backup retained for historical contacts and quotation communication tracking.",
            "payloadKind": "xlsx",
            "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "createdAt": 1_773_388_800_000,
            "modifiedAt": 1_773_388_800_000,
        },
        {
            "path": "/sdcard/Download/项目交接/launch_plan_draft_0.docx",
            "content": "Launch plan working notes with schedule discussion, risks, and meeting notes; not a replacement for the signed-off plan.",
            "payloadKind": "docx",
            "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "createdAt": 1_774_339_200_000,
            "modifiedAt": 1_774_339_200_000,
        },
        {
            "path": "/sdcard/Download/项目交接/handoff_notes_1.txt",
            "content": "Handoff notes: account owners, meeting-record location, open-issue owners, and next sync time.",
            "mimeType": "text/plain",
            "createdAt": 1_773_450_000_000,
            "modifiedAt": 1_773_450_000_000,
        },
        {
            "path": "/sdcard/Download/项目交接/client_requirements_1.docx",
            "content": "Client requirements with mandatory flows, permission limits, audit trail requirements, acceptance criteria, and deferred features.",
            "payloadKind": "docx",
            "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "createdAt": 1_773_453_600_000,
            "modifiedAt": 1_773_453_600_000,
        },
    ]

    async def _prepare(self, env: Any) -> None:
        await env.page.evaluate(
            """async ({files}) => {
                const fs = window.__SIM_FS__;
                if (!fs) return;
                const escapePdfText = (text) => String(text).replace(/[\\\\()]/g, '\\\\$&').replace(/\\r?\\n/g, ' | ');
                const encoder = new TextEncoder();
                const escapeXml = (text) => String(text).replace(/[<>&"']/g, (ch) => ({
                    '<': '&lt;',
                    '>': '&gt;',
                    '&': '&amp;',
                    '"': '&quot;',
                    "'": '&apos;',
                }[ch]));
                const crcTable = Array.from({ length: 256 }, (_, n) => {
                    let c = n;
                    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                    return c >>> 0;
                });
                const crc32 = (bytes) => {
                    let c = 0xffffffff;
                    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
                    return (c ^ 0xffffffff) >>> 0;
                };
                const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
                const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
                const concatBytes = (parts) => {
                    const total = parts.reduce((sum, part) => sum + part.length, 0);
                    const out = new Uint8Array(total);
                    let offset = 0;
                    for (const part of parts) {
                        out.set(part, offset);
                        offset += part.length;
                    }
                    return out;
                };
                const makeZipBlob = (entries, mimeType) => {
                    const locals = [];
                    const central = [];
                    let offset = 0;
                    for (const [name, text] of Object.entries(entries)) {
                        const nameBytes = encoder.encode(name);
                        const data = encoder.encode(text);
                        const crc = crc32(data);
                        const local = concatBytes([
                            u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(33),
                            u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
                            nameBytes, data,
                        ]);
                        const centralEntry = concatBytes([
                            u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(33),
                            u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
                            u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
                        ]);
                        locals.push(local);
                        central.push(centralEntry);
                        offset += local.length;
                    }
                    const centralDir = concatBytes(central);
                    const end = concatBytes([
                        u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
                        u32(centralDir.length), u32(offset), u16(0),
                    ]);
                    return new Blob([concatBytes([...locals, centralDir, end])], { type: mimeType });
                };
                const makeDocxBlob = (text, mimeType) => {
                    const paragraphs = String(text).split(/\\r?\\n/).map((line) => (
                        `<w:p><w:r><w:t>${escapeXml(line || ' ')}</w:t></w:r></w:p>`
                    )).join('');
                    return makeZipBlob({
                        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
                        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
                        'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`,
                    }, mimeType);
                };
                const makeXlsxBlob = (text, mimeType) => {
                    const rows = String(text).split(/\\r?\\n/).map((line, index) => {
                        const row = index + 1;
                        return `<row r="${row}"><c r="A${row}" t="inlineStr"><is><t>${escapeXml(line || ' ')}</t></is></c></row>`;
                    }).join('');
                    return makeZipBlob({
                        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
                        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
                        'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
                        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
                        'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
                    }, mimeType);
                };
                const makePdfBlob = (text) => {
                    const safe = escapePdfText(text).slice(0, 900);
                    const objects = [
                        '1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n',
                        '2 0 obj\\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\\nendobj\\n',
                        '3 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\\nendobj\\n',
                        '4 0 obj\\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\\nendobj\\n',
                    ];
                    const stream = `BT /F1 12 Tf 72 720 Td (${safe}) Tj ET`;
                    objects.push(`5 0 obj\\n<< /Length ${stream.length} >>\\nstream\\n${stream}\\nendstream\\nendobj\\n`);
                    let pdf = '%PDF-1.4\\n';
                    const offsets = [0];
                    for (const obj of objects) {
                        offsets.push(pdf.length);
                        pdf += obj;
                    }
                    const xrefOffset = pdf.length;
                    pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
                    for (let i = 1; i <= objects.length; i += 1) {
                        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \\n`;
                    }
                    pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF`;
                    return new Blob([pdf], { type: 'application/pdf' });
                };
                const payloadFor = (file) => {
                    if (file.payloadKind === 'pdf') return makePdfBlob(file.content);
                    if (file.payloadKind === 'docx') return makeDocxBlob(file.content, file.mimeType);
                    if (file.payloadKind === 'xlsx') return makeXlsxBlob(file.content, file.mimeType);
                    return file.content;
                };
                if (fs.exists('/sdcard/Download/项目交接')) {
                    await fs.delete('/sdcard/Download/项目交接');
                }
                await fs.mkdir('/sdcard/Download/项目交接');
                for (const file of files) {
                    await fs.write(file.path, payloadFor(file), {
                        mimeType: file.mimeType,
                        createdAt: file.createdAt,
                        modifiedAt: file.modifiedAt,
                    });
                }
            }""",
            {"files": self.seed_files},
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        fs = FileSystem(input.os["fileSystem"], init=input.os_init["fileSystem"])
        return [
            fs.check_paths_deleted(self.target_paths, field="file_system.obsolete_deleted"),
            fs.check_paths_preserved(self.preserve_paths, field="file_system.important_preserved"),
        ]
