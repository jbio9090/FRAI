import { router, useForm } from '@inertiajs/react';
import { Plus, X, Pencil, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemActions, ItemDescription } from '@/components/ui/item';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';


interface Rule {
    id: number;
    rule: string;
    created_at: string;
}

interface DashboardProps {
    children: React.ReactNode;
    rules: Rule[];
}

export default function Rules({ rules }: DashboardProps) {

    const { hasPermission } = usePermission();
    const [showInput, setInputState] = useState<boolean>(false);
    const { post, data, setData } = useForm({
        rule: "",
    });

    function submit(e) {
        e.preventDefault();

        post(route('rules.add'), {
            onSuccess: () => {
                setData("rule", "");
                setInputState(false);
            },
            onError: (errors) => {
                console.log("Errors:", errors);
            },
        });
    }

    return (
        <DefaultLayout>
            <h1 className='text-lg font-bold'>Rules</h1>
            {hasPermission("modify rules") && (
                <header className='flex w-full max-w-4xl'>
                    <Button variant={"outline"} size={"sm"} onClick={() => setInputState(!showInput)}>
                        <Plus />
                        <span>Add Rule</span>
                    </Button>
                </header>)
            }

            {(hasPermission("modify rules") && showInput) && (
                <Field>
                    <Input
                        name='rule'
                        placeholder='Input your rule here'
                        value={data.rule}
                        onChange={(e) => setData("rule", e.currentTarget.value)}
                    />
                    <Button type="submit" className='max-w-24 align-end' onClick={submit}>
                        Submit
                    </Button>
                </Field>
            )}

            <div className="flex flex-col w-full max-w-4xl">
                {rules.map((rule) => (
                    <RuleItem id={rule.id}>
                        {rule.rule}
                    </RuleItem>
                ))}
            </div>
        </DefaultLayout>
    );
}


interface RuleItemProps {
    children: React.ReactNode;
    id: number;
}

function RuleItem({ children, id }: RuleItemProps) {
    const { hasPermission } = usePermission();
    const [isEditing, setIsEditing] = useState(false);
    const [editedRule, setEditedRule] = useState(children as string);

    function remove(e) {
        e.preventDefault();

        router.delete(route('rules.remove'), {
            data: { id },
            onSuccess: () => {
                console.log("Remove success!");
            },
            onError: (errors) => {
                console.log("Remove errors:", errors);
            },
        });
    }

    function startEdit(e) {
        e.preventDefault();
        setIsEditing(true);
    }

function saveEdit(e) {
        e.preventDefault();
        console.log("Saving edit for rule:", id, "with value:", editedRule);

        router.put(route('rules.update'), { 
            id, 
            rule: editedRule 
        }, {
            onSuccess: () => {
                console.log("Update success!");
                setIsEditing(false);
            },
            onError: (errors) => {
                console.log("Update errors:", errors);
            },
        });
    }

    function cancelEdit(e) {
        e.preventDefault();
        setEditedRule(children as string);
        setIsEditing(false);
    }

    return (
        <Item id={id.toString()} key={id.toString() + children}>
            <ItemContent>
                {isEditing ? (
                    <Input
                        value={editedRule}
                        onChange={(e) => setEditedRule(e.target.value)}
                        className="text-sm"
                    />
                ) : (
                    <ItemDescription>
                        {children}
                    </ItemDescription>
                )}
            </ItemContent>

            {hasPermission("modify rules") && (
                <ItemActions>
                    {isEditing ? (
                        <>
                            <Button size={"icon-xs"} variant={"outline"} onClick={saveEdit}>
                                <Check />
                            </Button>
                            <Button size={"icon-xs"} variant={"outline"} onClick={cancelEdit}>
                                <X />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size={"icon-xs"} variant={"outline"} onClick={startEdit}>
                                <Pencil />
                            </Button>
                            <Button size={"icon-xs"} variant={"outline"} onClick={remove}>
                                <X />
                            </Button>
                        </>
                    )}
                </ItemActions>
            )}
        </Item>
    );
}