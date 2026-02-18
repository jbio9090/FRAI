import { Link } from "@inertiajs/react";
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
    capacity: number
}

interface FacilityProps {
    children: React.ReactNode;
    facilities: Facility[];
}

export default function Facilities({ facilities }: FacilityProps) {
    return (
        <DefaultLayout>
            <h1>Facilities</h1>

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
                        <TableRow>
                            <TableCell><Link className="w-full" href={route("facility.detail", [facility.id])}>{facility.name}</Link></TableCell>
                            <TableCell><Link href={route("facility.detail", [facility.id])}>{facility.building}</Link></TableCell>
                            <TableCell><Link href={route("facility.detail", [facility.id])}>{facility.capacity}</Link></TableCell>
                        </TableRow>
                    ))}

                </TableBody>
            </Table>
        </DefaultLayout>
    );
}
