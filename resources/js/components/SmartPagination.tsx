import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationEllipsis, PaginationPrevious } from "./ui/pagination";
import { useState } from "react";


export default function SmartPagination({ currentPage, lastPage, onPageChange }: {
    currentPage: number;
    lastPage: number;
    onPageChange: (page: number) => void;
}) {
    const [editingLeft, setEditingLeft] = useState(false);
    const [editingRight, setEditingRight] = useState(false);
    const [inputVal, setInputVal] = useState("");

    const handleJump = (side: 'left' | 'right') => {
        const page = parseInt(inputVal);
        if (!isNaN(page) && page >= 1 && page <= lastPage) {
            onPageChange(page);
        }
        side === 'left' ? setEditingLeft(false) : setEditingRight(false);
        setInputVal("");
    }

    const getPageWindow = () => {
        const delta = 2; // pages on each side of current
        const range: number[] = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(lastPage - 1, currentPage + delta); i++) {
            range.push(i);
        }
        return range;
    }

    const pageWindow = getPageWindow();
    const showLeftEllipsis = pageWindow[0] > 2;
    const showRightEllipsis = pageWindow[pageWindow.length - 1] < lastPage - 1;

    return (
        <Pagination>
            <PaginationContent>
                {/* Prev */}
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                </PaginationItem>

                {/* First page */}
                <PaginationItem>
                    <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(1); }} isActive={currentPage === 1}>
                        1
                    </PaginationLink>
                </PaginationItem>

                {/* Left ellipsis */}
                {showLeftEllipsis && (
                    <PaginationItem>
                        {editingLeft ? (
                            <input
                                autoFocus
                                type="number"
                                className="w-12 h-9 text-center border rounded-md text-sm"
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                onBlur={() => { handleJump('left'); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleJump('left'); if (e.key === 'Escape') setEditingLeft(false); }}
                            />
                        ) : (
                            <PaginationEllipsis className="cursor-pointer" onClick={() => { setEditingLeft(true); setEditingRight(false); }} />
                        )}
                    </PaginationItem>
                )}

                {/* Page window */}
                {pageWindow.map((page) => (
                    <PaginationItem key={page}>
                        <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(page); }} isActive={currentPage === page}>
                            {page}
                        </PaginationLink>
                    </PaginationItem>
                ))}

                {/* Right ellipsis */}
                {showRightEllipsis && (
                    <PaginationItem>
                        {editingRight ? (
                            <input
                                autoFocus
                                type="number"
                                className="w-12 h-9 text-center border rounded-md text-sm"
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                onBlur={() => handleJump('right')}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleJump('right'); if (e.key === 'Escape') setEditingRight(false); }}
                            />
                        ) : (
                            <PaginationEllipsis className="cursor-pointer" onClick={() => { setEditingRight(true); setEditingLeft(false); }} />
                        )}
                    </PaginationItem>
                )}

                {/* Last page */}
                {lastPage > 1 && (
                    <PaginationItem>
                        <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(lastPage); }} isActive={currentPage === lastPage}>
                            {lastPage}
                        </PaginationLink>
                    </PaginationItem>
                )}

                {/* Next */}
                <PaginationItem>
                    <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (currentPage < lastPage) onPageChange(currentPage + 1); }}
                        className={currentPage === lastPage ? 'pointer-events-none opacity-50' : ''}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}