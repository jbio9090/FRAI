import { router } from "@inertiajs/react";
import { Link } from "@inertiajs/react";
import { User, Building as BuildingIcon, MapPinned, Pencil, ChevronDown } from "lucide-react";
import { useState, type FormEvent } from "react";
import FacilityCalendar from "@/components/FacilityCalendar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks/use-permission";
import DefaultLayout from "@/layout.tsx/default.";

interface Equipment {
    id: number;
    name: string;
}

interface FacilityEquipment {
    id: number;
    facility_id: number;
    equipment_id: number;
    quantity: number;
    equipment?: Equipment;
}

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
    campus_id: number | null;
    building_id: number | null;
    campus?: Campus | null;
    building_record?: Building | null;
    facility_equipments?: FacilityEquipment[];
}

interface Campus {
    id: number;
    name: string;
}

interface Building {
    id: number;
    campus_id: number;
    name: string;
}

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
}

interface DetailProps {
    facility: Facility;
    initialEvents: Event[];
    facilities: Facility[];
    campuses: Campus[];
    buildings: Building[];
}

const isFormValid = (name: string, campusId: string, buildingId: string, capacity: number) => (
    name.trim() !== "" && campusId !== "" && buildingId !== "" && Number.isInteger(capacity) && capacity >= 1
);

export default function FacilityDetail({ facility, initialEvents, facilities, campuses, buildings }: DetailProps) {
    const { hasPermission } = usePermission();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(facility.name);
    const [campusId, setCampusId] = useState(facility.campus_id ? String(facility.campus_id) : "");
    const [buildingId, setBuildingId] = useState(facility.building_id ? String(facility.building_id) : "");
    const [capacity, setCapacity] = useState(facility.capacity);
    const filteredBuildings = buildings.filter((building) => String(building.campus_id) === campusId);
    const canSave = isFormValid(name, campusId, buildingId, capacity);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!canSave) return;

        router.put(route("facility.update", facility.id), {
            name,
            campus_id: Number(campusId),
            building_id: Number(buildingId),
            capacity,
        }, {
            onSuccess: () => setIsEditing(false),
        });
    };

    const equipments = facility.facility_equipments ?? [];

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-4 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-xl">{facility.name}</h3>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                                <ChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuGroup>
                                {facilities.map((f) => (
                                    <Link key={f.id} href={route("facility.detail", [f.id])}>
                                        <DropdownMenuItem>{f.name}</DropdownMenuItem>
                                    </Link>
                                ))}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {hasPermission("manage facilities") && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <Pencil size={16} />
                        </Button>
                    )}
                </div>

                {/* Meta */}
                <div className="flex text-muted-foreground gap-1 mt-1 items-center">
                    <MapPinned size={16} />
                    <span className="text-sm">{facility.campus?.name ?? "Main"}</span>
                </div>
                <div className="flex text-muted-foreground gap-1 mt-1 items-center">
                    <BuildingIcon size={16} />
                    <span className="text-sm">{facility.building_record?.name ?? facility.building}</span>
                </div>
                <div className="flex text-muted-foreground items-center gap-1 mt-1">
                    <User size={16} />
                    <span className="text-sm">{facility?.capacity ? facility?.capacity + " capacity" : "N/A"}</span>
                </div>

                {isEditing && (
                    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 rounded-md border p-4 max-w-sm">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Campus</Label>
                            <Select
                                value={campusId}
                                onValueChange={(value) => {
                                    setCampusId(value);
                                    setBuildingId("");
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select campus" />
                                </SelectTrigger>
                                <SelectContent>
                                    {campuses.map((campus) => (
                                        <SelectItem key={campus.id} value={String(campus.id)}>
                                            {campus.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Building</Label>
                            <Select
                                value={buildingId}
                                onValueChange={setBuildingId}
                                disabled={!campusId || filteredBuildings.length === 0}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={campusId ? "Select building" : "Select campus first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredBuildings.map((building) => (
                                        <SelectItem key={building.id} value={String(building.id)}>
                                            {building.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="capacity">Capacity</Label>
                            <Input
                                id="capacity"
                                type="number"
                                value={capacity}
                                onChange={(e) => setCapacity(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={!canSave}>Save</Button>
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <Tabs defaultValue="calendar" className="md:px-8">
                <TabsList variant="line">
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
                    <TabsTrigger value="equipment">Equipment</TabsTrigger>
                </TabsList>

                <TabsContent value="calendar" className="p-0">
                    <FacilityCalendar
                        facilityId={facility.id}
                        initialEvents={initialEvents}
                    />
                </TabsContent>

                <TabsContent value="equipment" className="p-0">
                    {equipments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                            No equipment listed for this facility.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Equipment</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {equipments.map((eq, i) => (
                                    <TableRow key={eq.id}>
                                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                        <TableCell>{eq.equipment?.name ?? `Equipment #${eq.equipment_id}`}</TableCell>
                                        <TableCell className="text-right tabular-nums">{eq.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </TabsContent>
            </Tabs>
        </DefaultLayout>
    );
}
