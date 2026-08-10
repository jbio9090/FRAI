import { router, useForm } from '@inertiajs/react';
import { Check, ChevronDown, ChevronUp, Pencil, Plus, X } from 'lucide-react';
import moment from 'moment';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';

type RuleEntry = {
    id: number;
    rule: string;
    priority: number;
    forPolicy: 0 | 1;
    faq_answer: string | null;
    created_at: string;
};

type RulesPageProps = {
    policies: RuleEntry[];
    faqs: RuleEntry[];
};

type RuleFormData = {
    rule: string;
    forPolicy: 0 | 1;
    faq_answer: string;
};

export default function RulesPage({ policies, faqs }: RulesPageProps) {
    const { hasPermission } = usePermission();
    const reduceMotion = useReducedMotion();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createAsFaq, setCreateAsFaq] = useState(false);

    const { post, data, setData, processing, errors, reset } = useForm<RuleFormData>({
        rule: '',
        forPolicy: 0,
        faq_answer: '',
    });

    useEffect(() => {
        setData('forPolicy', createAsFaq ? 1 : 0);
        if (!createAsFaq) {
            setData('faq_answer', '');
        }
    }, [createAsFaq, setData]);

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('rules.add'), {
            onSuccess: () => {
                reset();
                setCreateAsFaq(false);
                setShowCreateForm(false);
            },
        });
    };

    const motionProps = {
        initial: reduceMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
    };

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <motion.div {...motionProps}>
                    <div className="flex flex-col gap-1">
                        <p className="ads-eyebrow">Policy &amp; knowledge base</p>
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Rules</h1>
                        <p className="text-sm text-muted-foreground">
                            Rules the AI enforces on requests, plus FAQ answers the chatbot uses.
                        </p>
                    </div>
                </motion.div>

                {hasPermission('modify rules') && (
                    <motion.div {...motionProps} className="flex items-center gap-3">
                        <Button onClick={() => setShowCreateForm(true)}>
                            <Plus className="h-4 w-4" />
                            Add entry
                        </Button>
                    </motion.div>
                )}

                <motion.div {...motionProps} className="flex flex-col gap-6">
                    <RuleSection title="Policy rules" eyebrow="AI enforcement" rows={policies} />
                    <RuleSection title="FAQ entries" eyebrow="Chatbot knowledge" rows={faqs} showFaqAnswer />
                </motion.div>
            </div>

            {hasPermission('modify rules') && (
                <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                    <DialogContent className="sm:max-w-md">
                        <form onSubmit={submitCreate}>
                            <DialogHeader>
                                <DialogTitle>{createAsFaq ? 'New FAQ entry' : 'New policy rule'}</DialogTitle>
                                <DialogDescription>
                                    {createAsFaq
                                        ? 'The chatbot will answer requests with this question and answer.'
                                        : 'The AI will enforce this rule when evaluating requests.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="create-as-faq"
                                        checked={createAsFaq}
                                        onCheckedChange={(checked) => setCreateAsFaq(checked === true)}
                                    />
                                    <Label htmlFor="create-as-faq" className="font-medium">
                                        Mark as FAQ entry
                                    </Label>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-rule">{createAsFaq ? 'FAQ question' : 'Policy rule'}</Label>
                                    <Input
                                        id="create-rule"
                                        value={data.rule}
                                        onChange={(e) => setData('rule', e.target.value)}
                                        placeholder={createAsFaq ? 'Enter FAQ question' : 'Enter policy rule'}
                                    />
                                    {errors.rule && <p className="text-xs text-destructive">{errors.rule}</p>}
                                </div>

                                {createAsFaq && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="create-faq-answer">FAQ answer</Label>
                                        <Textarea
                                            id="create-faq-answer"
                                            value={data.faq_answer}
                                            onChange={(e) => setData('faq_answer', e.target.value)}
                                            placeholder="Enter the chatbot answer for this FAQ"
                                        />
                                        {errors.faq_answer && (
                                            <p className="text-xs text-destructive">{errors.faq_answer}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        reset();
                                        setCreateAsFaq(false);
                                        setShowCreateForm(false);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving…' : 'Save'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DefaultLayout>
    );
}

function RuleSection({
    title,
    eyebrow,
    rows,
    showFaqAnswer = false,
}: {
    title: string;
    eyebrow: string;
    rows: RuleEntry[];
    showFaqAnswer?: boolean;
}) {
    const { hasPermission } = usePermission();
    const canManage = hasPermission('modify rules');

    return (
        <section className="ads-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <div className="flex flex-col gap-0.5">
                    <span className="ads-eyebrow">{eyebrow}</span>
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                </div>
                <span className="ml-auto rounded-[4px] bg-[var(--ads-neutral-bg)] px-2 py-0.5 text-xs font-medium text-[var(--ads-neutral)]">
                    {rows.length}
                </span>
            </div>

            {rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {canManage
                        ? showFaqAnswer
                            ? 'No FAQ entries yet. Add questions the chatbot can answer.'
                            : 'No policy rules yet. Add the first rule the AI should enforce.'
                        : 'No entries found.'}
                </p>
            ) : (
                <div>
                    {rows.map((row, index) => (
                        <RuleRow
                            key={row.id}
                            row={row}
                            isFirst={index === 0}
                            isLast={index === rows.length - 1}
                            showFaqAnswer={showFaqAnswer}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function RuleRow({
    row,
    isFirst,
    isLast,
    showFaqAnswer,
}: {
    row: RuleEntry;
    isFirst: boolean;
    isLast: boolean;
    showFaqAnswer: boolean;
}) {
    const { hasPermission } = usePermission();
    const [isEditing, setIsEditing] = useState(false);
    const [editRule, setEditRule] = useState(row.rule);
    const [editFaqAnswer, setEditFaqAnswer] = useState(row.faq_answer ?? '');
    const [editAsFaq, setEditAsFaq] = useState(row.forPolicy === 1);

    const submitUpdate = () => {
        router.put(route('rules.update'), {
            id: row.id,
            rule: editRule,
            forPolicy: editAsFaq ? 1 : 0,
            faq_answer: editAsFaq ? editFaqAnswer : null,
        }, {
            onSuccess: () => setIsEditing(false),
        });
    };

    const remove = () => {
        router.delete(route('rules.remove'), {
            data: { id: row.id },
        });
    };

    const reorder = (direction: 'up' | 'down') => {
        router.put(route('rules.reorder'), { id: row.id, direction });
    };

    const cancelEdit = () => {
        setEditRule(row.rule);
        setEditFaqAnswer(row.faq_answer ?? '');
        setEditAsFaq(row.forPolicy === 1);
        setIsEditing(false);
    };

    const isFaq = row.forPolicy === 1;

    return (
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/50">
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <span className="rounded-[4px] bg-[var(--ads-neutral-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--ads-neutral)]">
                    P#{row.priority + 1}
                </span>
                <span
                    className={cn(
                        'rounded-[4px] px-2 py-0.5 text-xs font-semibold',
                        isFaq ? 'bg-[var(--ads-ac-academic)] text-[var(--ads-ac-ink-academic)]' : 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]'
                    )}
                >
                    {isFaq ? 'FAQ' : 'Policy'}
                </span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
                {isEditing ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`edit-faq-${row.id}`}
                                checked={editAsFaq}
                                onCheckedChange={(checked) => {
                                    setEditAsFaq(checked === true);
                                    if (checked !== true) {
                                        setEditFaqAnswer('');
                                    }
                                }}
                            />
                            <Label htmlFor={`edit-faq-${row.id}`} className="font-medium">
                                Mark as FAQ entry
                            </Label>
                        </div>

                        <Input value={editRule} onChange={(e) => setEditRule(e.target.value)} />

                        {editAsFaq && (
                            <Textarea
                                value={editFaqAnswer}
                                onChange={(e) => setEditFaqAnswer(e.target.value)}
                                placeholder="FAQ Answer"
                            />
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-foreground">{row.rule}</p>
                        {showFaqAnswer && (
                            <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-muted-foreground">
                                {row.faq_answer || 'No FAQ answer provided.'}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">{moment(row.created_at).fromNow()}</p>
                    </div>
                )}
            </div>

            {hasPermission('modify rules') && (
                <div className="flex shrink-0 flex-col gap-2">
                    {!isEditing && (
                        <>
                            <Button size="icon-xs" variant="ghost" disabled={isFirst} onClick={() => reorder('up')} aria-label="Move up">
                                <ChevronUp />
                            </Button>
                            <Button size="icon-xs" variant="ghost" disabled={isLast} onClick={() => reorder('down')} aria-label="Move down">
                                <ChevronDown />
                            </Button>
                        </>
                    )}

                    {isEditing ? (
                        <>
                            <Button size="icon-xs" variant="outline" onClick={submitUpdate} aria-label="Save changes">
                                <Check />
                            </Button>
                            <Button size="icon-xs" variant="outline" onClick={cancelEdit} aria-label="Cancel editing">
                                <X />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="icon-xs" variant="outline" onClick={() => setIsEditing(true)} aria-label="Edit entry">
                                <Pencil />
                            </Button>
                            <Button size="icon-xs" variant="outline" onClick={remove} aria-label="Delete entry">
                                <X />
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
