import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { Link, usePage } from '@inertiajs/react';
import { Calendar } from 'lucide-react';
import moment from 'moment';

// interface DashboardProps {
//     children: React.ReactNode;
// }



export default function Dashboard({ pending, approved, denied }: { pending: Request[], approved: Request[], denied: Request[] }) {
    const { auth } = usePage().props;
    const { hasRole } = usePermission();

    return (
        <DefaultLayout>
            <div className="flex text-sm gap-2 items-center">
                <Calendar size={16} />
                <p>{moment().format("MMM Do, YYYY")}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 md:grid grid-cols-[1fr_1fr_1fr]">
                <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                    <p className='text-sm'>Pending Requests</p>
                    <p className='text-4xl font-bold'>{pending.length}</p>
                    <Link href={route("requests.index")}>
                        <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                    </Link>
                </div>

                <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                    <p className='text-sm'>Approved Requests you made</p>
                    <p className='text-4xl font-bold'>{approved.length}</p>
                    <Link href={route("requests.index")}>
                        <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                    </Link>
                </div>

                <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                    <p className='text-sm'>Denied Requests you made</p>
                    <p className='text-4xl font-bold'>{denied.length}</p>
                    <Link href={route("requests.index")}>
                        <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                    </Link>
                </div>

            </div>
        </DefaultLayout>
    );
}
