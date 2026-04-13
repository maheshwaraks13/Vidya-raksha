"""
VidyaRaksha — ML Training Pipeline
Trains Random Forest and XGBoost models for dropout prediction.
Includes data generation, preprocessing, training, evaluation, and model saving.
"""
import numpy as np
import pandas as pd
import pickle
import os
import json
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, classification_report,
    confusion_matrix, precision_score, recall_score
)
import warnings
warnings.filterwarnings('ignore')


def generate_synthetic_dataset(n_samples=500, random_state=42):
    """
    Generate a realistic synthetic dataset of rural Indian students.
    Mimics real-world distributions for rural schools.
    """
    np.random.seed(random_state)
    
    data = {
        'age': np.random.randint(10, 18, n_samples),
        'gender': np.random.choice(['M', 'F'], n_samples, p=[0.52, 0.48]),
        'grade': np.random.randint(5, 12, n_samples),
        'attendance': np.clip(np.random.normal(65, 20, n_samples), 10, 100).round(1),
        'exam_score': np.clip(np.random.normal(50, 22, n_samples), 5, 100).round(1),
        'distance': np.clip(np.random.exponential(5, n_samples), 0.5, 25).round(1),
        'family_income': np.clip(np.random.lognormal(9.0, 0.7, n_samples), 2000, 50000).round(0),
        'parent_education': np.random.choice([0, 1, 2, 3], n_samples, p=[0.35, 0.30, 0.25, 0.10]),
        'parent_occupation': np.random.choice([0, 1, 2, 3], n_samples, p=[0.30, 0.35, 0.25, 0.10]),
        'health_issues': np.random.choice([0, 1], n_samples, p=[0.75, 0.25]),
        'internet_access': np.random.choice([0, 1], n_samples, p=[0.60, 0.40]),
        'previous_failures': np.random.choice([0, 1, 2, 3], n_samples, p=[0.50, 0.25, 0.15, 0.10]),
        'transport_available': np.random.choice([0, 1], n_samples, p=[0.55, 0.45]),
    }
    
    df = pd.DataFrame(data)
    
    # Create dropout probability based on weighted features (realistic logic)
    dropout_prob = (
        0.30 * (1 - df['attendance'] / 100) +
        0.20 * (1 - df['exam_score'] / 100) +
        0.12 * np.clip(df['distance'] / 20, 0, 1) +
        0.15 * (1 - np.clip(df['family_income'] / 25000, 0, 1)) +
        0.08 * (1 - df['parent_education'] / 3) +
        0.05 * df['health_issues'] +
        0.04 * (1 - df['internet_access']) +
        0.03 * df['previous_failures'] / 3 +
        0.02 * (1 - df['transport_available']) +
        0.01 * (df['gender'] == 'F').astype(int)  # slight bias (reflecting real rural data)
    )
    
    # Add noise
    dropout_prob += np.random.normal(0, 0.05, n_samples)
    dropout_prob = np.clip(dropout_prob, 0, 1)
    
    # Binary label: 1 = dropout, 0 = not dropout
    df['dropout'] = (dropout_prob > 0.45).astype(int)
    df['dropout_probability'] = dropout_prob.round(4)
    
    return df


def preprocess_data(df):
    """
    Preprocess the dataset:
    - Encode categorical variables
    - Handle missing data
    - Scale numerical features
    """
    df = df.copy()
    
    # Handle missing values
    df.fillna({
        'attendance': df['attendance'].median(),
        'exam_score': df['exam_score'].median(),
        'distance': df['distance'].median(),
        'family_income': df['family_income'].median(),
        'parent_education': 0,
        'health_issues': 0,
        'internet_access': 0,
        'previous_failures': 0,
        'transport_available': 0
    }, inplace=True)
    
    # Encode gender
    df['gender_encoded'] = (df['gender'] == 'F').astype(int)
    
    # Feature columns
    feature_cols = [
        'age', 'grade', 'attendance', 'exam_score', 'distance',
        'family_income', 'parent_education', 'parent_occupation',
        'health_issues', 'internet_access', 'previous_failures',
        'transport_available', 'gender_encoded'
    ]
    
    X = df[feature_cols].values
    y = df['dropout'].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    return X_scaled, y, scaler, feature_cols


def train_models(X_train, y_train, X_test, y_test):
    """
    Train multiple models and compare performance:
    1. Logistic Regression
    2. Random Forest
    3. Gradient Boosting (XGBoost-like)
    """
    models = {
        'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
        'Random Forest': RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        ),
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.1,
            min_samples_split=5,
            random_state=42
        )
    }
    
    results = {}
    best_model = None
    best_score = 0
    best_name = ''
    
    for name, model in models.items():
        print(f"\n{'='*50}")
        print(f"Training: {name}")
        print('='*50)
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]
        
        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        roc_auc = roc_auc_score(y_test, y_prob)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        
        # Cross-validation
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='f1')
        
        results[name] = {
            'accuracy': round(accuracy * 100, 2),
            'f1_score': round(f1 * 100, 2),
            'roc_auc': round(roc_auc * 100, 2),
            'precision': round(precision * 100, 2),
            'recall': round(recall * 100, 2),
            'cv_f1_mean': round(cv_scores.mean() * 100, 2),
            'cv_f1_std': round(cv_scores.std() * 100, 2)
        }
        
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  ROC-AUC:   {roc_auc:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  CV F1:     {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        
        # Select best model based on F1 score
        if f1 > best_score:
            best_score = f1
            best_model = model
            best_name = name
        
        print(f"\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Not Dropout', 'Dropout']))
    
    print(f"\n{'='*50}")
    print(f"🏆 Best Model: {best_name} (F1: {best_score:.4f})")
    print('='*50)
    
    return best_model, best_name, results


def save_model(model, scaler, feature_cols, results, model_dir=None):
    """Save the trained model, scaler, and metadata"""
    if model_dir is None:
        model_dir = os.path.dirname(os.path.abspath(__file__))
    
    os.makedirs(model_dir, exist_ok=True)
    
    # Save model
    model_path = os.path.join(model_dir, 'trained_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"✅ Model saved to {model_path}")
    
    # Save scaler
    scaler_path = os.path.join(model_dir, 'scaler.pkl')
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"✅ Scaler saved to {scaler_path}")
    
    # Save metadata
    metadata = {
        'feature_columns': feature_cols,
        'model_results': results,
        'model_type': type(model).__name__,
        'n_features': len(feature_cols)
    }
    metadata_path = os.path.join(model_dir, 'model_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✅ Metadata saved to {metadata_path}")
    
    return model_path, scaler_path


def run_training_pipeline():
    """Execute the complete training pipeline"""
    print("🚀 VidyaRaksha ML Training Pipeline")
    print("=" * 60)
    
    # Step 1: Generate dataset
    print("\n📊 Step 1: Generating synthetic dataset...")
    df = generate_synthetic_dataset(n_samples=500)
    print(f"   Generated {len(df)} samples")
    print(f"   Dropout rate: {df['dropout'].mean()*100:.1f}%")
    print(f"   Feature distributions:")
    print(f"     - Attendance: {df['attendance'].mean():.1f}% (avg)")
    print(f"     - Exam Score: {df['exam_score'].mean():.1f}% (avg)")
    print(f"     - Income: ₹{df['family_income'].mean():.0f} (avg)")
    
    # Save dataset
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, 'sample_students.csv')
    df.to_csv(csv_path, index=False)
    print(f"   Dataset saved to {csv_path}")
    
    # Step 2: Preprocess
    print("\n🔧 Step 2: Preprocessing data...")
    X, y, scaler, feature_cols = preprocess_data(df)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"   Train set: {len(X_train)} samples")
    print(f"   Test set:  {len(X_test)} samples")
    
    # Step 3: Train models
    print("\n🤖 Step 3: Training models...")
    best_model, best_name, results = train_models(X_train, y_train, X_test, y_test)
    
    # Step 4: Save
    print("\n💾 Step 4: Saving best model...")
    model_dir = os.path.dirname(os.path.abspath(__file__))
    save_model(best_model, scaler, feature_cols, results, model_dir)
    
    print("\n✅ Training pipeline completed successfully!")
    return best_model, scaler, feature_cols, results


if __name__ == '__main__':
    run_training_pipeline()
