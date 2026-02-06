import DefaultLayout from "@/layout.tsx/default.";
import { useState } from "react";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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

export default function Facilities({ children, facilities }: FacilityProps) {
    return (
        <DefaultLayout>
            <h1>Facilities</h1>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Building</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>

                    {facilities.map((facility) => (
                        <TableRow>
                            <TableCell className="">{facility.name}</TableCell>
                            <TableCell className="">{facility.building}</TableCell>
                        </TableRow>
                    ))}

                </TableBody>
            </Table>
        </DefaultLayout>
    );
}