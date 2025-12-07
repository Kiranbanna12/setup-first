import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, ListChecks, AlignLeft, AlignCenter,
    AlignRight, AlignJustify, Highlighter, Type, Link2,
    Image as ImageIcon, Code, Quote, Minus, Undo, Redo,
    Table as TableIcon, Palette, Heading1, Heading2, Heading3,
    FileCode, Eraser
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

interface AdvancedRichEditorProps {
    value?: string;
    onChange?: (val: string) => void;
    placeholder?: string;
}

interface TableInsertDialogProps {
    onInsert: (rows: number, cols: number) => void;
    onClose: () => void;
}

const TableInsertDialog: React.FC<TableInsertDialogProps> = ({ onInsert, onClose }) => {
    const [rows, setRows] = React.useState(3);
    const [cols, setCols] = React.useState(3);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card p-4 md:p-6 rounded-lg shadow-lg max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Insert Table</h3>
                <div className="space-y-3 md:space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Rows</label>
                        <Input type="number" min="1" max="20" value={rows} onChange={e => setRows(parseInt(e.target.value) || 1)} className="h-9" />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Columns</label>
                        <Input type="number" min="1" max="10" value={cols} onChange={e => setCols(parseInt(e.target.value) || 1)} className="h-9" />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={onClose} className="h-9">Cancel</Button>
                        <Button onClick={() => { onInsert(rows, cols); onClose(); }} className="h-9">Insert</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdvancedRichEditor: React.FC<AdvancedRichEditorProps> = ({
    value = '',
    onChange,
    placeholder = 'Start typing...'
}) => {
    const [showTableDialog, setShowTableDialog] = React.useState(false);
    const extensions = React.useMemo(() => [
        StarterKit,
        Underline,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
            alignments: ['left', 'center', 'right', 'justify'],
        }),
        Highlight.configure({
            multicolor: true,
        }),
        TextStyle,
        Color,
        FontFamily.configure({
            types: ['textStyle'],
        }),
        TaskList,
        TaskItem.configure({
            nested: true,
        }),
        Table.configure({
            resizable: true,
            allowTableNodeSelection: true,
            HTMLAttributes: {
                class: 'border-collapse border-2 border-gray-400 my-4',
            },
        }),
        TableRow,
        TableCell.configure({
            HTMLAttributes: {
                class: 'border border-gray-300 px-3 py-2 min-w-[100px]',
            },
        }),
        TableHeader.configure({
            HTMLAttributes: {
                class: 'border-2 border-gray-400 px-3 py-2 bg-blue-50 font-semibold text-left',
            },
        }),
        Image,
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: 'text-blue-500 underline cursor-pointer',
            }
        }),
    ], []);

    const editor = useEditor({
        extensions,
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none min-h-[400px] p-4 focus:outline-none',
            },
            handlePaste: (view, event) => {
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                // Check if pasted content has HTML (formatted content)
                const html = clipboardData.getData('text/html');
                const text = clipboardData.getData('text/plain');

                // If there's HTML content, let TipTap handle it (preserves formatting)
                if (html) {
                    // TipTap will automatically handle HTML tables and formatting
                    return false; // Let default handler process
                }

                // If plain text with tabs (like Excel data), convert to table
                if (text && text.includes('\t')) {
                    const rows = text.trim().split('\n');
                    const hasMultipleColumns = rows.some(row => row.includes('\t'));

                    if (hasMultipleColumns && rows.length > 1) {
                        event.preventDefault();

                        // Parse the data
                        const tableData = rows.map(row => row.split('\t'));
                        const cols = Math.max(...tableData.map(row => row.length));
                        const rowCount = tableData.length;

                        // Create table
                        editor?.chain()
                            .focus()
                            .insertTable({ rows: rowCount, cols: cols, withHeaderRow: true })
                            .run();

                        // Fill table with data
                        setTimeout(() => {
                            tableData.forEach((row, rowIndex) => {
                                row.forEach((cell, colIndex) => {
                                    editor?.chain()
                                        .focus()
                                        .setCellSelection({
                                            anchorCell: rowIndex * cols + colIndex,
                                            headCell: rowIndex * cols + colIndex,
                                        })
                                        .insertContent(cell)
                                        .run();
                                });
                            });
                        }, 50);

                        return true;
                    }
                }

                return false; // Let default paste handler work
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange?.(html);
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    const addImage = useCallback(() => {
        const url = window.prompt('Enter image URL:');
        if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const addLink = useCallback(() => {
        const url = window.prompt('Enter URL:');
        if (url && editor) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

    const setColor = useCallback((color: string) => {
        if (editor) {
            editor.chain().focus().setColor(color).run();
        }
    }, [editor]);

    const setHighlight = useCallback((color: string) => {
        if (editor) {
            editor.chain().focus().setHighlight({ color }).run();
        }
    }, [editor]);

    const setFontSize = useCallback((size: string) => {
        if (editor) {
            editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
        }
    }, [editor]);

    if (!editor) {
        return <div className="p-4 text-muted-foreground">Loading editor...</div>;
    }

    return (
        <div className="border rounded-lg overflow-hidden bg-card h-full flex flex-col">
            {/* Toolbar - Organized in rows */}
            <div className="border-b bg-muted/30 overflow-x-auto flex-shrink-0">
                {/* Row 1: History & Style */}
                <div className="p-2 flex items-center gap-1 border-b min-w-max">
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                        <Undo className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                        <Redo className="w-4 h-4" />
                    </Button>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Select
                        value={
                            editor.isActive('heading', { level: 1 }) ? '1' :
                                editor.isActive('heading', { level: 2 }) ? '2' :
                                    editor.isActive('heading', { level: 3 }) ? '3' : 'normal'
                        }
                        onValueChange={(value) => {
                            if (value === 'normal') {
                                editor.chain().focus().setParagraph().run();
                            } else {
                                editor.chain().focus().toggleHeading({ level: parseInt(value) as any }).run();
                            }
                        }}
                    >
                        <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Style" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">Normal Text</SelectItem>
                            <SelectItem value="1">Heading 1</SelectItem>
                            <SelectItem value="2">Heading 2</SelectItem>
                            <SelectItem value="3">Heading 3</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select defaultValue="16px" onValueChange={setFontSize}>
                        <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="12px">12</SelectItem>
                            <SelectItem value="14px">14</SelectItem>
                            <SelectItem value="16px">16</SelectItem>
                            <SelectItem value="18px">18</SelectItem>
                            <SelectItem value="20px">20</SelectItem>
                            <SelectItem value="24px">24</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 2: Text Formatting */}
                <div className="p-2 flex items-center gap-1 min-w-max">
                    <Button size="sm" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
                        <Bold className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
                        <Italic className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('underline') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
                        <UnderlineIcon className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
                        <Strikethrough className="w-4 h-4" />
                    </Button>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" title="Text Color"><Palette className="w-4 h-4" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            <div className="text-xs font-medium mb-2">Text Color</div>
                            <div className="grid grid-cols-6 gap-1">
                                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'].map((color) => (
                                    <button key={color} className="w-6 h-6 rounded border" style={{ backgroundColor: color }} onClick={() => setColor(color)} />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" title="Highlight"><Highlighter className="w-4 h-4" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            <div className="text-xs font-medium mb-2">Highlight</div>
                            <div className="grid grid-cols-6 gap-1">
                                {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FFA500', '#FF69B4', '#90EE90', '#FFB6C1', '#DDA0DD', '#F0E68C'].map((color) => (
                                    <button key={color} className="w-6 h-6 rounded border" style={{ backgroundColor: color }} onClick={() => setHighlight(color)} />
                                ))}
                            </div>
                            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => editor.chain().focus().unsetHighlight().run()}>
                                <Eraser className="w-3 h-3 mr-1" />Remove
                            </Button>
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Button size="sm" variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
                        <AlignLeft className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center">
                        <AlignCenter className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
                        <AlignRight className="w-4 h-4" />
                    </Button>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Button size="sm" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
                        <List className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
                        <ListOrdered className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('taskList') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
                        <ListChecks className="w-4 h-4" />
                    </Button>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant={editor.isActive('table') ? 'secondary' : 'ghost'} title="Table">
                                <TableIcon className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            {!editor.isActive('table') ? (
                                <DropdownMenuItem onClick={() => setShowTableDialog(true)}>
                                    <TableIcon className="w-4 h-4 mr-2" />
                                    Insert Table...
                                </DropdownMenuItem>
                            ) : (
                                <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Table Options</div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                                        ➕ Add Column Before
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                                        ➕ Add Column After
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                                        ➖ Delete Column
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                                        ⬆️ Add Row Above
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                                        ⬇️ Add Row Below
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                                        ➖ Delete Row
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                                        {editor.can().toggleHeaderRow() ? '🔄 Toggle Header Row' : '✓ Header Row Active'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>
                                        {editor.can().toggleHeaderColumn() ? '🔄 Toggle Header Column' : '✓ Header Column Active'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().mergeCells()}>
                                        🔗 Merge Cells
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().splitCell()}>
                                        ✂️ Split Cell
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} className="text-red-600">
                                        🗑️ Delete Table
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button size="sm" variant="ghost" onClick={addLink} title="Insert Link">
                        <Link2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={addImage} title="Insert Image">
                        <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
                        <FileCode className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
                        <Quote className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto">
                <EditorContent editor={editor} className="h-full" />
                <style>{`
          .ProseMirror {
            padding: 0.75rem;
            min-height: 100%;
            height: auto;
            outline: none;
          }
          @media (min-width: 640px) {
            .ProseMirror {
              padding: 1rem;
            }
          }
          @media (min-width: 768px) {
            .ProseMirror {
              padding: 1.25rem;
            }
          }
          @media (min-width: 1024px) {
            .ProseMirror {
              padding: 1.5rem;
            }
          }
          .ProseMirror table {
            border-collapse: collapse;
            margin: 1em 0;
            overflow-x: auto;
            display: block;
            max-width: 100%;
            table-layout: auto;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          @media (min-width: 768px) {
            .ProseMirror table {
              display: table;
              width: 100%;
            }
          }
          .ProseMirror table td,
          .ProseMirror table th {
            border: 1px solid #cbd5e0;
            box-sizing: border-box;
            min-width: 80px;
            padding: 6px 8px;
            position: relative;
            vertical-align: top;
            background-color: white;
            font-size: 14px;
          }
          @media (min-width: 768px) {
            .ProseMirror table td,
            .ProseMirror table th {
              min-width: 100px;
              padding: 8px 12px;
              font-size: 16px;
            }
          }
          .ProseMirror table th {
            background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
            font-weight: 600;
            text-align: left;
            border: 2px solid #93c5fd;
            color: #1e40af;
          }
          .ProseMirror table tr:hover td {
            background-color: #f8fafc;
          }
          .ProseMirror table .selectedCell {
            background-color: #dbeafe !important;
            outline: 2px solid #3b82f6;
            outline-offset: -1px;
          }
          .ProseMirror table .selectedCell:after {
            background: rgba(59, 130, 246, 0.1);
            content: "";
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            pointer-events: none;
            position: absolute;
            z-index: 2;
          }
          .ProseMirror table .column-resize-handle {
            background-color: #3b82f6;
            bottom: -2px;
            position: absolute;
            right: -2px;
            pointer-events: none;
            top: 0;
            width: 3px;
            cursor: col-resize;
          }
          .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
          }
          .ProseMirror ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
          }
          .ProseMirror ul[data-type="taskList"] li > label {
            flex: 0 0 auto;
            margin-right: 0.5rem;
            user-select: none;
            min-width: 20px;
            min-height: 20px;
          }
          .ProseMirror ul[data-type="taskList"] li > div {
            flex: 1 1 auto;
          }
          @media (max-width: 768px) {
            .ProseMirror ul[data-type="taskList"] li > label {
              min-width: 24px;
              min-height: 24px;
            }
          }
          .ProseMirror pre {
            background: #0d0d0d;
            border-radius: 0.5rem;
            color: #fff;
            font-family: 'JetBrainsMono', monospace;
            padding: 0.5rem 0.75rem;
            font-size: 13px;
            overflow-x: auto;
          }
          @media (min-width: 768px) {
            .ProseMirror pre {
              padding: 0.75rem 1rem;
              font-size: 14px;
            }
          }
          .ProseMirror code {
            background-color: rgba(97, 97, 97, 0.1);
            border-radius: 0.25rem;
            color: #616161;
            font-size: 0.85rem;
            padding: 0.2em 0.3em;
          }
          @media (min-width: 768px) {
            .ProseMirror code {
              font-size: 0.9rem;
            }
          }
          .ProseMirror p,
          .ProseMirror li {
            line-height: 1.6;
          }
          .ProseMirror h1 {
            font-size: 1.75rem;
            line-height: 1.2;
          }
          .ProseMirror h2 {
            font-size: 1.5rem;
            line-height: 1.3;
          }
          .ProseMirror h3 {
            font-size: 1.25rem;
            line-height: 1.4;
          }
          @media (min-width: 768px) {
            .ProseMirror h1 {
              font-size: 2rem;
            }
            .ProseMirror h2 {
              font-size: 1.75rem;
            }
            .ProseMirror h3 {
              font-size: 1.5rem;
            }
          }
        `}</style>
            </div>

            {/* Table Insert Dialog */}
            {showTableDialog && (
                <TableInsertDialog
                    onInsert={(rows, cols) => {
                        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
                    }}
                    onClose={() => setShowTableDialog(false)}
                />
            )}
        </div>
    );
};

export default AdvancedRichEditor;
