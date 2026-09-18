import { Link } from 'react-router-dom';

import CollectionIcon from '@/app/components/collection-icon';
import type { TagType } from '@/types/admin';

import { HELP_CENTER_COLLECTIONS_PATH } from '../../constants';

export interface CollectionCardProps {
    category: TagType;
}

const CollectionCard = (props: CollectionCardProps) => {
    const { category } = props;

    const renderCount = () => {
        if (typeof category.postCount !== 'number') {
            return null;
        }

        return (
            <span className="collection-card-count mt-auto pt-2 text-sm font-medium text-(--text-primary)">
                {category.postCount} {category.postCount === 1 ? 'article' : 'articles'}
            </span>
        );
    };

    return (
        <li className="collection-card-item flex">
            <Link
                to={`${HELP_CENTER_COLLECTIONS_PATH}/${category._id}`}
                className="collection-card blog-card-hover flex w-full flex-col gap-4 rounded-3xl bg-card px-6 pt-7 pb-5"
            >
                <CollectionIcon icon={category.icon} alt={category.name} size="lg" />
                <div className="flex flex-col gap-1">
                    <h3 className="collection-card-title text-lg leading-snug font-semibold text-(--text-title)">
                        {category.name}
                    </h3>
                    {category.description ? (
                        <p className="collection-card-description line-clamp-2 text-sm text-text-secondary">
                            {category.description}
                        </p>
                    ) : null}
                    {renderCount()}
                </div>
            </Link>
        </li>
    );
};

export default CollectionCard;
