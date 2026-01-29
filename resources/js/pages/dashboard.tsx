import { useForm } from '@inertiajs/react';

export default function Dashboard() {
    const {post} = useForm({});

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <>
            <h1>
                Dashboard
            </h1>

            <form onSubmit={submit} method="post">
                <button type="submit">Logout</button>
            </form>
        </>

    );
}