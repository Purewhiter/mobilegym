import React, { useState, useEffect, useRef } from 'react';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { Invoice } from '../../../types';
import * as TimeService from '../../../../../os/TimeService';
import { useWechatGestures } from '../../../hooks/useWechatGestures';
import { useWechatStrings } from '../../../hooks/useWechatStrings';

let localSeq = 0;
function nextInvoiceId(): string {
    localSeq += 1;
    return `invoice_${TimeService.now()}_${localSeq}`;
}

export const InvoiceListPage = () => {
    const t = useWechatStrings();
    const invoices = useWechatStore(s => s.user.invoices);

    if (invoices.length === 0) {
        return (
            <div className="min-h-full bg-app-surface flex flex-col items-center justify-center -mt-20">
                <div className="text-(--app-c-tw-text-gray-400) text-(--app-chat-bubble-text-size) mb-2">{t.invoice_empty}</div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-app-bg">
            {invoices.map((inv, idx) => (
                <div key={idx} className="bg-app-surface p-4 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1 text-xs border rounded ${inv.type === '单位' ? 'border-blue-500 text-blue-500' : 'border-green-500 text-green-500'}`}>{inv.type === '单位' ? t.invoice_type_company : t.invoice_type_personal}</span>
                        <span className="text-app-text text-(--app-chat-bubble-text-size) font-medium">{inv.name}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const AddInvoicePage = () => {
    const t = useWechatStrings();
    const { addInvoice, setRightAction } = useWechatStore(useShallow(s => ({
        addInvoice: s.addInvoice,
        setRightAction: s.setRightAction,
    })));
    const { back } = useWechatGestures();
    const [form, setForm] = useState<Invoice>({
        id: nextInvoiceId(),
        type: '个人',
        name: '',
        taxId: ''
    });
    const formRef = useRef(form);

    useEffect(() => {
        formRef.current = form;
    }, [form]);

    useEffect(() => {
        setRightAction({
            onTrigger: () => {
            const currentForm = formRef.current;
            if (!currentForm.name) return;
            addInvoice(currentForm);
            back();
            },
        });
        return () => setRightAction(null);
    }, [addInvoice, setRightAction, back]);

    const Field = ({ label, placeholder, value, onChange }: any) => (
        <div className="flex items-center py-4 border-b border-(--app-c-tw-border-gray-100)">
            <span className="w-28 max-w-[7rem] shrink-0 text-(--app-chat-bubble-text-size) text-app-text leading-tight break-words [overflow-wrap:anywhere]">{label}</span>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="flex-1 outline-none text-(--app-chat-bubble-text-size)"
            />
        </div>
    );

    return (
        <div className="min-h-full bg-app-surface px-4 pt-4">
            <div className="flex items-center mb-6">
                <span className="w-28 max-w-[7rem] shrink-0 text-(--app-chat-bubble-text-size) text-app-text leading-tight break-words [overflow-wrap:anywhere]">{t.invoice_type_label}</span>
                <div className="flex gap-4">
                    <button
                        onClick={() => setForm(f => ({ ...f, type: '个人' }))}
                        className={`px-6 py-1.5 border rounded text-sm ${form.type === '个人' ? 'border-app-primary text-app-primary' : 'border-app-border text-app-text'}`}
                    >{t.invoice_type_personal}</button>
                    <button
                        onClick={() => setForm(f => ({ ...f, type: '单位' }))}
                        className={`px-6 py-1.5 border rounded text-sm ${form.type === '单位' ? 'border-app-primary text-app-primary' : 'border-app-border text-app-text'}`}
                    >{t.invoice_type_company}</button>
                </div>
            </div>

            <Field
                label={t.invoice_name_label}
                placeholder={t.invoice_name_placeholder}
                value={form.name}
                onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))}
            />

            {form.type === '单位' && (
                <Field
                    label={t.invoice_tax_label}
                    placeholder={t.invoice_tax_placeholder}
                    value={form.taxId}
                    onChange={(e: any) => setForm(f => ({ ...f, taxId: e.target.value }))}
                />
            )}
        </div>
    )
}
