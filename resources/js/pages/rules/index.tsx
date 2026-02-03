import { router, useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { usePermission } from '@/hooks/use-permission';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemActions, ItemDescription } from '@/components/ui/item';

interface Rule {
    id: number;
    rule: string;
    created_at: string;
}

interface DashboardProps {
    children: React.ReactNode;
    rules: Rule[];
}

export default function Rules({ children, rules }: DashboardProps) {

    const { hasPermission, hasRole } = usePermission();
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

    return (
        <Item id={id.toString()} key={id.toString() + children}>
            <ItemContent>
                <ItemDescription>
                    {children}
                </ItemDescription>
            </ItemContent>

            <ItemActions>
                <Button size={"icon-xs"} variant={"outline"} onClick={remove}>
                    <X />
                </Button>
            </ItemActions>
        </Item>
    );
}