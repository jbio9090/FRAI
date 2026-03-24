import { router } from "@inertiajs/react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import DefaultLayout from "@/layout.tsx/default.";

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
}

interface FacilityProps {
    facilities: Facility[];
}

export default function Facilities({ facilities }: FacilityProps) {
    return (
        <DefaultLayout>
            <h1 className='font-bold text-xl'>Facilities</h1>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Building</TableHead>
                        <TableHead className="font-bold">Capacity</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {facilities.map((facility) => (
                        <TableRow
                            key={facility.id}
                            className="cursor-pointer"
                            onClick={() => router.visit(route("facility.detail", [facility.id]))}
                        >
                            <TableCell>{facility.name}</TableCell>
                            <TableCell>{facility.building}</TableCell>
                            <TableCell>{facility.capacity}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </DefaultLayout>
    );
}