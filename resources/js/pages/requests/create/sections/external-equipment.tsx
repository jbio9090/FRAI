import { Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

export interface ExternalEquipmentProps {
    isExternalOpen: boolean;
    setIsExternalOpen: (open: boolean) => void;
    externalEquipment: { name: string }[];
    setExternalEquipment: React.Dispatch<React.SetStateAction<{ name: string }[]>>;
    externalEquipmentInput: string;
    setExternalEquipmentInput: (value: string) => void;
}

export function ExternalEquipmentCollapsible({
    isExternalOpen,
    setIsExternalOpen,
    externalEquipment,
    setExternalEquipment,
    externalEquipmentInput,
    setExternalEquipmentInput,
}: ExternalEquipmentProps) {
    const addItem = () => {
        const trimmed = externalEquipmentInput.trim();
        if (!trimmed) return;
        setExternalEquipment((prev) => [...prev, { name: trimmed }]);
        setExternalEquipmentInput('');
    };

    return (
        <Collapsible open={isExternalOpen} onOpenChange={setIsExternalOpen}>
            <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                    {isExternalOpen ? <Minus size={16} /> : <Plus size={16} />}
                    <span>Add external equipment</span>
                    {externalEquipment.length > 0 && (
                        <span className="ml-auto rounded-[4px] bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                            {externalEquipment.length}
                        </span>
                    )}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-3 space-y-3 px-1">
                    <p className="text-sm text-muted-foreground">List equipment you'll be bringing that isn't in our inventory.</p>
                    {externalEquipment.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {externalEquipment.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex w-fit items-center justify-between gap-1 rounded-md border bg-muted/20 px-2 py-1 text-sm"
                                >
                                    <span>{item.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => setExternalEquipment((prev) => prev.filter((_, idx) => idx !== i))}
                                    >
                                        <X size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g., Portable speaker"
                            value={externalEquipmentInput}
                            onChange={(e) => setExternalEquipmentInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addItem();
                                }
                            }}
                            className="text-sm"
                        />
                        <Button type="button" variant="secondary" onClick={addItem}>
                            Add
                        </Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
